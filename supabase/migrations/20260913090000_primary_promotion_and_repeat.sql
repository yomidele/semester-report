-- Promotion / repeat-a-class for the primary school.
--
-- Problem this fixes: promote_students_to_session() (from the original
-- college project) is still wired up, runs automatically the moment a new
-- academic session is created, and:
--   1. Decides who repeats based on "carryover" (failing one specific
--      subject) — not how a primary school decides whether a pupil repeats
--      a class.
--   2. Only touches student_academic_records.level (100/200/300/400,
--      college-style) — it never updates students.department_id or
--      students.class_arm_id, so it can't actually move a pupil from one
--      primary class to the next anywhere the rest of the app can see.
--   3. Gives no one — teacher, form master, or exam officer — any way to
--      manually hold a specific pupil back regardless of the automatic
--      decision.
--
-- This migration removes whatever trigger currently fires that function
-- (found dynamically, since its exact name isn't in this repo's migration
-- history — see NOTES.md on the base-schema gap) and replaces it with a
-- primary-school-appropriate version that still runs automatically on new
-- session creation, but:
--   - follows an explicit "next class" chain the exam officer configures
--     (departments.next_department_id), so promotion actually changes
--     students.department_id
--   - lets the exam officer flag a specific pupil to repeat beforehand
--     (students.repeat_flag) — those pupils are skipped by the automatic
--     run instead of being promoted
--   - records what happened in a new student_class_history table, so there
--     is a permanent, visible record of who was promoted/repeated/flagged
--     as completing their final class, per session

-- 1. Remove the old trigger wherever it lives (name unknown from this
--    repo's history alone), without touching the old function itself in
--    case something else still references it.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tgname, tgrelid::regclass AS tbl
    FROM pg_trigger
    WHERE tgfoid = 'public.promote_students_to_session(uuid)'::regprocedure
      AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', r.tgname, r.tbl);
  END LOOP;
EXCEPTION WHEN undefined_function THEN
  -- promote_students_to_session doesn't exist on this database — nothing to remove.
  NULL;
END $$;

-- 2. Configurable "what class comes after this one" chain.
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS next_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- 3. Exam-officer override: flag a specific pupil to repeat instead of
--    being auto-promoted. Reset back to false once processed.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS repeat_flag boolean NOT NULL DEFAULT false;

-- 4. Permanent record of what happened to each pupil at each session change.
CREATE TABLE IF NOT EXISTS public.student_class_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  from_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  to_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  from_class_arm_id uuid REFERENCES public.class_arms(id) ON DELETE SET NULL,
  outcome text NOT NULL CHECK (outcome IN ('promoted', 'repeated', 'completed_final_class')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_class_history_student ON public.student_class_history(student_id);
CREATE INDEX IF NOT EXISTS idx_student_class_history_session ON public.student_class_history(session_id);

ALTER TABLE public.student_class_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exam officers and super admins view class history" ON public.student_class_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'exam_officer') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Students view their own class history" ON public.student_class_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_class_history.student_id AND s.user_id = auth.uid()));

-- 5. The new promotion function itself. SECURITY DEFINER + execute revoked
--    from normal roles (matching the old function's pattern) — it's only
--    ever called by the trigger below (which runs as the function owner)
--    or via the service-role client from a server function, never directly
--    by a logged-in user.
CREATE OR REPLACE FUNCTION public.promote_primary_students(new_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s RECORD;
BEGIN
  FOR s IN
    SELECT st.id, st.department_id, st.class_arm_id, st.repeat_flag, d.next_department_id
    FROM public.students st
    LEFT JOIN public.departments d ON d.id = st.department_id
  LOOP
    IF s.repeat_flag THEN
      INSERT INTO public.student_class_history (student_id, session_id, from_department_id, to_department_id, from_class_arm_id, outcome)
      VALUES (s.id, new_session_id, s.department_id, s.department_id, s.class_arm_id, 'repeated');

      UPDATE public.students SET repeat_flag = false WHERE id = s.id;

    ELSIF s.next_department_id IS NOT NULL THEN
      INSERT INTO public.student_class_history (student_id, session_id, from_department_id, to_department_id, from_class_arm_id, outcome)
      VALUES (s.id, new_session_id, s.department_id, s.next_department_id, s.class_arm_id, 'promoted');

      -- class_arm_id is cleared: arms belong to one specific department, so
      -- last session's "4A" has no meaning in the new class. The exam
      -- officer assigns the new arm from the Classes & Arms screen.
      UPDATE public.students SET department_id = s.next_department_id, class_arm_id = NULL WHERE id = s.id;

    ELSE
      -- Top of the configured chain (e.g. Primary 6 with no next class set)
      -- and not flagged to repeat: recorded as having completed their
      -- final class here. Nothing is changed on the student record — the
      -- exam officer decides what happens next (mark as left the school,
      -- configure a JSS1 department and link it, etc.).
      INSERT INTO public.student_class_history (student_id, session_id, from_department_id, to_department_id, from_class_arm_id, outcome)
      VALUES (s.id, new_session_id, s.department_id, NULL, s.class_arm_id, 'completed_final_class');
    END IF;
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.promote_primary_students(uuid) FROM anon, authenticated, public;

-- 6. Wire it back up to fire automatically the moment a new session is
--    created — same "auto" behaviour as before, just doing the right thing.
CREATE OR REPLACE FUNCTION public.trg_promote_primary_students()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.promote_primary_students(NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_academic_sessions_promote_primary ON public.academic_sessions;
CREATE TRIGGER trg_academic_sessions_promote_primary
  AFTER INSERT ON public.academic_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_promote_primary_students();
