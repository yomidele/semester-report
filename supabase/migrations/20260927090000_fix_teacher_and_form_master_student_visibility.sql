-- ROOT CAUSE #1 (confirmed): there has never been an RLS policy granting a
-- regular teacher SELECT access to `students`. Every existing SELECT policy
-- on students is scoped to super_admin, exam_officer, admission_officer, or
-- (as of 20260923090000) a Form Master via class_arms.form_teacher_id. A
-- teacher who is merely assigned to teach a subject to a class via
-- `course_assignments` was never granted read access to that class's
-- roster at all — so "assign a teacher to a class/subject, teacher can't
-- see the students" is Postgres RLS silently returning zero rows, not an
-- application bug. This has been the case since before the role
-- restructuring; the restructuring didn't introduce it, but it also didn't
-- fix it, and it's the same shape of gap as the Form Master case below.
--
-- ROOT CAUSE #2 (latent, same family of bug): the Form Master policies added
-- in 20260925140000 (on students, results, attendance, report_card_comments)
-- all read `public.lecturers` from *inside* another table's RLS policy via a
-- plain SQL join:
--   JOIN public.lecturers l ON l.id = ca.form_teacher_id WHERE l.user_id = auth.uid()
-- A nested query inside an RLS policy is evaluated with the CURRENT USER's
-- own privileges, not elevated ones — so it is itself subject to whatever
-- RLS policy exists on `lecturers`. This repo's migrations only ever grant
-- `lecturers` SELECT to exam_officer; nothing here proves a teacher can
-- read even their OWN lecturers row from within a nested policy subquery
-- (useRole() reading it directly from the client only proves a *direct*
-- query works, which depends on a self-view policy that may or may not
-- compose correctly inside a nested EXISTS elsewhere). Rather than depend on
-- exactly how that self-view policy is written, this migration moves every
-- Form Master / assigned-teacher check into SECURITY DEFINER helper
-- functions — the same pattern this project already uses for has_role() —
-- so these checks run with elevated privileges and can never be silently
-- defeated by RLS on a table three joins away.

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER: bypass RLS internally, so callers only
-- need EXECUTE on the function, not SELECT on every table it touches).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_lecturer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.lecturers WHERE user_id = auth.uid() LIMIT 1;
$$;

-- True if the signed-in teacher is the Form Master of this class arm.
CREATE OR REPLACE FUNCTION public.is_form_master_of_class(_class_arm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_arms
    WHERE id = _class_arm_id AND form_teacher_id = public.current_lecturer_id()
  );
$$;

-- True if the signed-in teacher is the Form Master of the class this
-- student belongs to.
CREATE OR REPLACE FUNCTION public.is_form_master_of_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = _student_id AND public.is_form_master_of_class(s.class_arm_id)
  );
$$;

-- True if the signed-in teacher has a course_assignments row that covers
-- this class arm / department. Mirrors the fallback the app itself already
-- uses (src/routes/lecturer.entry.tsx): an assignment with a specific
-- class_arm_id covers only that arm; an assignment with class_arm_id left
-- null covers every arm in that department (e.g. "teaches Math to all of
-- Primary 4", not just Primary 4A).
CREATE OR REPLACE FUNCTION public.teaches_class(_class_arm_id uuid, _department_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_assignments ca
    WHERE ca.lecturer_id = public.current_lecturer_id()
      AND (
        (ca.class_arm_id IS NOT NULL AND ca.class_arm_id = _class_arm_id)
        OR (ca.class_arm_id IS NULL AND ca.department_id = _department_id)
      )
  );
$$;

-- Same, but keyed by student_id for policies on tables like results/
-- attendance that don't carry department_id directly on every row.
CREATE OR REPLACE FUNCTION public.teaches_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = _student_id AND public.teaches_class(s.class_arm_id, s.department_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_lecturer_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_form_master_of_class(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_form_master_of_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teaches_class(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teaches_student(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- students: replace the old raw-join Form Master policy with the definer-
-- function version, and add the missing policy for a regular subject
-- teacher.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Form masters view their class roster" ON public.students;

CREATE POLICY "Form masters view their class roster" ON public.students
  FOR SELECT TO authenticated
  USING (public.is_form_master_of_class(class_arm_id));

CREATE POLICY "Teachers view students in their assigned classes" ON public.students
  FOR SELECT TO authenticated
  USING (public.teaches_class(class_arm_id, department_id));

-- ---------------------------------------------------------------------------
-- results: the Form Master policy from 20260925140000 has the same
-- raw-join issue; replace it, and add the assigned-teacher equivalent in
-- case the base schema's teacher policy (not visible in this migrations
-- folder) is narrower than expected. Additive/idempotent — if a working
-- teacher policy already exists here, this is a harmless duplicate since
-- permissive policies are OR'd together.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Form masters view assigned class results" ON public.results;

CREATE POLICY "Form masters view assigned class results" ON public.results
  FOR SELECT TO authenticated
  USING (public.is_form_master_of_student(student_id));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'results' AND policyname = 'Teachers view assigned class results') THEN
    CREATE POLICY "Teachers view assigned class results" ON public.results
      FOR SELECT TO authenticated
      USING (public.teaches_student(student_id));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- report_card_comments: same fix for the Form Master policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Form masters view assigned class comments" ON public.report_card_comments;
DROP POLICY IF EXISTS "Form masters manage assigned class comments" ON public.report_card_comments;

CREATE POLICY "Form masters manage assigned class comments" ON public.report_card_comments
  FOR ALL TO authenticated
  USING (public.is_form_master_of_student(student_id))
  WITH CHECK (public.is_form_master_of_student(student_id));

-- ---------------------------------------------------------------------------
-- attendance: same fix for the Form Master policy added in 20260925140000.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Form masters manage assigned class attendance" ON public.attendance;

CREATE POLICY "Form masters manage assigned class attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (public.is_form_master_of_student(student_id))
  WITH CHECK (public.is_form_master_of_student(student_id));
