-- Consolidate staff access around the four primary roles. Form Master remains
-- an assignment on the existing lecturer profile; no duplicate account/table
-- is introduced and all student/class/result records are preserved.

-- Upgrade existing teacher accounts from the legacy lecturer role.
DELETE FROM public.user_roles old_role
USING public.user_roles teacher_role
WHERE old_role.user_id = teacher_role.user_id
  AND old_role.role = 'lecturer'
  AND teacher_role.role = 'teacher';

UPDATE public.user_roles
SET role = 'teacher'
WHERE role = 'lecturer';

-- Section Admin / Class Admin accounts no longer authorize any portal.
-- Keep their auth users and historical profile records intact for safe manual
-- review, but remove the retired role grants so those accounts cannot access
-- staff functions through the application.
DELETE FROM public.user_roles
WHERE role IN ('faculty_admin', 'department_admin', 'student', 'parent');

CREATE OR REPLACE FUNCTION public.enforce_school_portal_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role NOT IN ('super_admin', 'teacher', 'exam_officer', 'admission_officer') THEN
    RAISE EXCEPTION 'Role % is not an active school portal role', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_school_portal_role ON public.user_roles;
CREATE TRIGGER trg_enforce_school_portal_role
  BEFORE INSERT OR UPDATE OF role ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_school_portal_role();

CREATE INDEX IF NOT EXISTS idx_class_arms_form_teacher_active
  ON public.class_arms (form_teacher_id)
  WHERE form_teacher_id IS NOT NULL;

-- Only teacher-role users can be assigned as Form Masters. This is enforced
-- for all writes, including service-role calls, not just the dashboard UI.
CREATE OR REPLACE FUNCTION public.enforce_form_teacher_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.form_teacher_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.lecturers l
    JOIN public.user_roles ur ON ur.user_id = l.user_id
    WHERE l.id = NEW.form_teacher_id
      AND ur.role = 'teacher'
  ) THEN
    RAISE EXCEPTION 'A Form Master must be an existing teacher';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_form_teacher_role ON public.class_arms;
CREATE TRIGGER trg_enforce_form_teacher_role
  BEFORE INSERT OR UPDATE OF form_teacher_id ON public.class_arms
  FOR EACH ROW EXECUTE FUNCTION public.enforce_form_teacher_role();

-- A teacher appointed as Form Master may read academic records only for the
-- students in their assigned class arm(s). Their normal course-assignment
-- permissions remain unchanged.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'results' AND policyname = 'Form masters view assigned class results') THEN
    CREATE POLICY "Form masters view assigned class results" ON public.results
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1
        FROM public.students s
        JOIN public.class_arms ca ON ca.id = s.class_arm_id
        JOIN public.lecturers l ON l.id = ca.form_teacher_id
        WHERE s.id = results.student_id AND l.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_card_comments' AND policyname = 'Form masters view assigned class comments') THEN
    CREATE POLICY "Form masters view assigned class comments" ON public.report_card_comments
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1
        FROM public.students s
        JOIN public.class_arms ca ON ca.id = s.class_arm_id
        JOIN public.lecturers l ON l.id = ca.form_teacher_id
        WHERE s.id = report_card_comments.student_id AND l.user_id = auth.uid()
      ));
  END IF;

  -- Exam officers retain read access to class structure, but assignment writes
  -- are reserved for Super Admin. Policies are permissive, so remove historical
  -- broad exam-officer write policies by their known names.
  DROP POLICY IF EXISTS "Exam officers manage class arms" ON public.class_arms;
  DROP POLICY IF EXISTS "Exam officers manage class levels" ON public.departments;
  DROP POLICY IF EXISTS "Exam officers manage departments" ON public.departments;
  DROP POLICY IF EXISTS "Exam officers manage course assignments" ON public.course_assignments;
  DROP POLICY IF EXISTS "Exam officers manage assignments" ON public.course_assignments;
  DROP POLICY IF EXISTS "Exam officers manage subjects" ON public.courses;
  DROP POLICY IF EXISTS "Staff manage class subjects" ON public.class_subjects;
  DROP POLICY IF EXISTS "School staff manage attendance" ON public.attendance;
  DROP POLICY IF EXISTS "School staff manage report card comments" ON public.report_card_comments;
END $$;

-- Replace the old all-teachers attendance/comment policies with class-scoped
-- Form Master access; retain full school-wide access for Super Admin.
CREATE POLICY "Super admins manage attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Form masters manage assigned class attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.class_arms ca
    JOIN public.lecturers l ON l.id = ca.form_teacher_id
    JOIN public.students s ON s.id = attendance.student_id AND s.class_arm_id = ca.id
    WHERE ca.id = attendance.class_arm_id AND l.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.class_arms ca
    JOIN public.lecturers l ON l.id = ca.form_teacher_id
    JOIN public.students s ON s.id = attendance.student_id AND s.class_arm_id = ca.id
    WHERE ca.id = attendance.class_arm_id AND l.user_id = auth.uid()
  ));

CREATE POLICY "Super admins manage report card comments" ON public.report_card_comments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Form masters manage assigned class comments" ON public.report_card_comments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.class_arms ca ON ca.id = s.class_arm_id
    JOIN public.lecturers l ON l.id = ca.form_teacher_id
    WHERE s.id = report_card_comments.student_id AND l.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.class_arms ca ON ca.id = s.class_arm_id
    JOIN public.lecturers l ON l.id = ca.form_teacher_id
    WHERE s.id = report_card_comments.student_id AND l.user_id = auth.uid()
  ));

-- Examination work includes creating sessions/terms and processing results;
-- class structure and staff/subject assignments remain Super Admin duties.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academic_sessions' AND policyname = 'Exam officers manage academic sessions') THEN
    CREATE POLICY "Exam officers manage academic sessions" ON public.academic_sessions
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'exam_officer') OR public.has_role(auth.uid(), 'super_admin'))
      WITH CHECK (public.has_role(auth.uid(), 'exam_officer') OR public.has_role(auth.uid(), 'super_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academic_settings' AND policyname = 'Exam officers manage academic settings') THEN
    CREATE POLICY "Exam officers manage academic settings" ON public.academic_settings
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'exam_officer') OR public.has_role(auth.uid(), 'super_admin'))
      WITH CHECK (public.has_role(auth.uid(), 'exam_officer') OR public.has_role(auth.uid(), 'super_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'applicants' AND policyname = 'Admission officers view applicants') THEN
    CREATE POLICY "Admission officers view applicants" ON public.applicants
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admission_officer') OR public.has_role(auth.uid(), 'super_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'applications' AND policyname = 'Admission officers manage applications') THEN
    CREATE POLICY "Admission officers manage applications" ON public.applications
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admission_officer') OR public.has_role(auth.uid(), 'super_admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admission_officer') OR public.has_role(auth.uid(), 'super_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'class_subjects' AND policyname = 'Super admins manage class subjects') THEN
    CREATE POLICY "Super admins manage class subjects" ON public.class_subjects
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'super_admin'))
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.enforce_form_teacher_role() TO authenticated;
