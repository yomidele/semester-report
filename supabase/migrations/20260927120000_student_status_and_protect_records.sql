-- Problem this fixes: /students (Student Management) had exactly one way
-- to take a pupil off the roster — a hard DELETE on public.students. Every
-- table that hangs off a student (results, attendance, report_card_comments,
-- student_fees, student_class_history) is FK'd with ON DELETE CASCADE, so
-- "remove this pupil" silently destroyed their entire academic history —
-- every score, every attendance mark, every report card comment, forever.
-- That's wrong for the two real-world reasons a pupil actually leaves a
-- class roster: they withdrew / were withdrawn / transferred to another
-- school (still need their records looked up for years), or they graduated
-- (definitely still need their records looked up for years).
--
-- This migration:
--   1. Adds a `status` lifecycle to students (active/withdrawn/transferred/
--      graduated) plus when/why it changed, so a pupil can be taken off the
--      *active* roster without ever deleting their row.
--   2. Makes it impossible — at the database level, regardless of what any
--      future UI does — to hard-delete a student who has any academic
--      history. This is a safety net, not just an app-layer convention: even
--      a mistaken or malicious direct DELETE will be blocked once a pupil
--      has a single result, attendance mark, fee record, or class-history
--      entry against their name. A pupil added in error with zero history
--      can still be deleted outright to correct a mistake.

-- 1. Status lifecycle -------------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_date date,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_status_check'
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_status_check
      CHECK (status IN ('active', 'withdrawn', 'transferred', 'graduated'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_status ON public.students (status);

-- 2. Permanent protection against losing history -----------------------------
CREATE OR REPLACE FUNCTION public.prevent_delete_students_with_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.results WHERE student_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.attendance WHERE student_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.report_card_comments WHERE student_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.student_class_history WHERE student_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.student_fees WHERE student_id = OLD.id)
  THEN
    RAISE EXCEPTION
      'Cannot permanently delete "%": they have academic history (results, attendance, fees, or class history) on record. Set their status to withdrawn, transferred, or graduated instead — that keeps their records searchable while taking them off the active roster.',
      OLD.full_name
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_delete_students_with_history ON public.students;
CREATE TRIGGER trg_prevent_delete_students_with_history
  BEFORE DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_students_with_history();

-- 3. Automatic promotion should only touch pupils still on the active
--    roster. Without this, a withdrawn/transferred/graduated pupil would
--    keep getting silently "promoted" into a new department_id every time a
--    new academic session is created, and would keep picking up new
--    student_class_history rows as if they were still attending.
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
    WHERE st.status = 'active'
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
      -- final class here. The exam officer can now mark them graduated from
      -- Student Management, which takes them off the active roster without
      -- deleting anything.
      INSERT INTO public.student_class_history (student_id, session_id, from_department_id, to_department_id, from_class_arm_id, outcome)
      VALUES (s.id, new_session_id, s.department_id, NULL, s.class_arm_id, 'completed_final_class');
    END IF;
  END LOOP;
END;
$function$;
