-- Audit fixes: result integrity, result locking and duplicate protection.
--
-- Everything here is idempotent (safe to run more than once) and additive:
-- no historical result is ever deleted. Rows that would violate the new
-- unique rules are COPIED to results_dedupe_archive first.

-- ---------------------------------------------------------------------------
-- 1) One result per pupil + subject + session + term.
--    (The same constraint exists in scripts/supabase/migrations/
--    20260930000000_add_results_unique_constraint.sql, which was stranded
--    outside supabase/migrations and so never ran from `supabase db push`.
--    That version DELETED duplicates; this one archives them first.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.results_dedupe_archive (
  LIKE public.results INCLUDING DEFAULTS,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archive_reason text
);
ALTER TABLE public.results_dedupe_archive ENABLE ROW LEVEL SECURITY;  -- no policies: service role / SQL editor only

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'results'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%(student_id, course_id, session_id, semester)%'
  ) THEN
    -- Keep the most advanced status (published > approved > submitted > draft),
    -- then the most recently updated row; archive the rest, then remove them.
    WITH ranked AS (
      SELECT id,
             row_number() OVER (
               PARTITION BY student_id, course_id, session_id, semester
               ORDER BY CASE status WHEN 'published' THEN 4 WHEN 'approved' THEN 3 WHEN 'submitted' THEN 2 ELSE 1 END DESC,
                        updated_at DESC NULLS LAST, id DESC
             ) AS rn
      FROM public.results
    ), losers AS (
      SELECT id FROM ranked WHERE rn > 1
    ), archived AS (
      INSERT INTO public.results_dedupe_archive
      SELECT r.*, now(), 'duplicate of same pupil/subject/session/term'
      FROM public.results r JOIN losers l ON l.id = r.id
      RETURNING id
    )
    DELETE FROM public.results WHERE id IN (SELECT id FROM archived);

    CREATE UNIQUE INDEX results_student_course_session_term_uniq
      ON public.results (student_id, course_id, session_id, semester);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) One teacher assignment per subject + class + session + term.
--    (Exact duplicates only; a null class_arm_id means "whole class level".)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'course_assignments_unique_slot'
  ) THEN
    DELETE FROM public.course_assignments a
    USING public.course_assignments b
    WHERE a.ctid > b.ctid
      AND a.lecturer_id = b.lecturer_id
      AND a.course_id = b.course_id
      AND a.session_id = b.session_id
      AND a.semester = b.semester
      AND a.department_id = b.department_id
      AND COALESCE(a.class_arm_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(b.class_arm_id, '00000000-0000-0000-0000-000000000000'::uuid);

    CREATE UNIQUE INDEX course_assignments_unique_slot
      ON public.course_assignments (
        lecturer_id, course_id, session_id, semester, department_id,
        COALESCE(class_arm_id, '00000000-0000-0000-0000-000000000000'::uuid)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Score bounds + write authorization + locking, enforced by the database.
--
--    The UI hides/disables locked rows, but a browser can call PostgREST
--    directly. This trigger is the real gate:
--      * CA must be 0–40 and Exam 0–60 (Total = CA + Exam ≤ 100) for everyone.
--      * Only the service role (the server functions in
--        result-workflow.functions.ts) may change `status`; a signed-in user
--        can therefore never publish, approve or un-lock a result, and a
--        teacher's upsert can no longer flip a submitted/published row back to
--        "draft" and overwrite its scores.
--      * Approved and published rows are frozen for every signed-in user.
--        Corrections go: Exam Officer "Return" (with a reason) → draft →
--        teacher fixes → submit → approve → publish.
--      * A teacher may only write DRAFT rows for a subject + class they are
--        assigned to for that exact session and term.
--      * The pupil / subject / session / term of an existing row is immutable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.results_validate_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_reviewer boolean;
  is_teacher boolean;
  stu_dept uuid;
  stu_arm uuid;
BEGIN
  -- Deleting
  IF TG_OP = 'DELETE' THEN
    IF uid IS NULL THEN RETURN OLD; END IF;              -- service role / SQL editor
    IF OLD.status IN ('approved', 'published') THEN
      RAISE EXCEPTION 'A % result cannot be deleted. Return it for correction first.', OLD.status;
    END IF;
    IF NOT (public.has_role(uid, 'super_admin') OR public.has_role(uid, 'exam_officer')) THEN
      RAISE EXCEPTION 'Only the Super Admin or Exam Officer can delete results.';
    END IF;
    RETURN OLD;
  END IF;

  -- Score bounds (applies to every caller, including the service role)
  IF NEW.ca_score IS NOT NULL AND (NEW.ca_score < 0 OR NEW.ca_score > 40) THEN
    RAISE EXCEPTION 'Continuous Assessment score must be between 0 and 40 (got %).', NEW.ca_score;
  END IF;
  IF NEW.exam_score IS NOT NULL AND (NEW.exam_score < 0 OR NEW.exam_score > 60) THEN
    RAISE EXCEPTION 'Examination score must be between 0 and 60 (got %).', NEW.exam_score;
  END IF;

  IF uid IS NULL THEN RETURN NEW; END IF;                 -- service role: workflow server functions

  is_reviewer := public.has_role(uid, 'super_admin') OR public.has_role(uid, 'exam_officer');
  is_teacher  := public.has_role(uid, 'teacher');

  IF NOT (is_reviewer OR is_teacher) THEN
    RAISE EXCEPTION 'You do not have permission to enter or change results.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.course_id IS DISTINCT FROM OLD.course_id
       OR NEW.session_id IS DISTINCT FROM OLD.session_id
       OR NEW.semester IS DISTINCT FROM OLD.semester THEN
      RAISE EXCEPTION 'The pupil, subject, session and term of a result cannot be changed.';
    END IF;
    IF OLD.status IN ('approved', 'published') THEN
      RAISE EXCEPTION 'This result is % and locked. Ask the Exam Officer to return it for correction.', OLD.status;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (is_reviewer AND OLD.status = 'draft' AND NEW.status = 'submitted') THEN
      RAISE EXCEPTION 'Result status can only be changed through the submit / approve / publish workflow.';
    END IF;
  ELSE -- INSERT
    IF NEW.status IS DISTINCT FROM 'draft' AND NEW.status IS DISTINCT FROM 'submitted' THEN
      RAISE EXCEPTION 'New results can only be created as draft or submitted.';
    END IF;
    IF NEW.status = 'submitted' AND NOT is_reviewer THEN
      RAISE EXCEPTION 'Teachers save drafts; submit them from the entry page.';
    END IF;
  END IF;

  -- Reviewers (Super Admin / Exam Officer) may enter or correct any unlocked row.
  IF is_reviewer THEN RETURN NEW; END IF;

  -- Teachers: must be assigned to this subject + class + session + term.
  SELECT s.department_id, s.class_arm_id INTO stu_dept, stu_arm
  FROM public.students s WHERE s.id = NEW.student_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.course_assignments ca
    WHERE ca.lecturer_id = public.current_lecturer_id()
      AND ca.course_id = NEW.course_id
      AND ca.session_id = NEW.session_id
      AND ca.semester = NEW.semester
      AND (
        (ca.class_arm_id IS NOT NULL AND ca.class_arm_id = stu_arm)
        OR (ca.class_arm_id IS NULL AND ca.department_id = stu_dept)
      )
  ) THEN
    RAISE EXCEPTION 'You are not assigned to teach this subject to this pupil''s class for this term.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_results_validate_write ON public.results;
CREATE TRIGGER trg_results_validate_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.results_validate_write();

-- ---------------------------------------------------------------------------
-- 4) Only ONE teacher can be Form Master of a class arm (it is a single
--    column) — but make sure changing/removing a teacher never leaves a
--    dangling reference. FK already exists; make removal safe.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT c.conname INTO fk_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.class_arms'::regclass
    AND c.contype = 'f'
    AND c.confrelid = 'public.lecturers'::regclass;
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.class_arms DROP CONSTRAINT %I', fk_name);
    ALTER TABLE public.class_arms
      ADD CONSTRAINT class_arms_form_teacher_id_fkey
      FOREIGN KEY (form_teacher_id) REFERENCES public.lecturers(id) ON DELETE SET NULL;
  END IF;
END $$;
