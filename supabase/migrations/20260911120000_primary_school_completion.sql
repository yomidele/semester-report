-- Completes the primary-school conversion started in the earlier "Kazaure branding"
-- and "953b5e72" migrations. Those added class_arms, attendance, and
-- report_card_comments tables but never wired them into students,
-- course_assignments, or the role system. This migration does that, and adds
-- the two staff roles the school actually needs: an Exam Officer (assigns
-- teachers to classes/subjects school-wide and compiles results) and an
-- Admission Officer (enrolls new pupils and issues admission letters).
--
-- Everything here is additive — no existing column, table, or policy is
-- dropped or altered destructively.

-- 1. New roles -----------------------------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'exam_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admission_officer';

-- 2. Form master per class arm -------------------------------------------
ALTER TABLE public.class_arms
  ADD COLUMN IF NOT EXISTS form_teacher_id uuid REFERENCES public.lecturers(id) ON DELETE SET NULL;

-- 3. Tie students to a specific arm, not just a class level ---------------
-- (students.arm already exists as a free-text column from an earlier
-- migration; class_arm_id is the real foreign key going forward. Both are
-- kept so existing data isn't lost — the app should prefer class_arm_id.)
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS class_arm_id uuid REFERENCES public.class_arms(id) ON DELETE SET NULL;

-- 4. Let a subject assignment target one specific arm, not the whole class
-- level. Nullable: leaving it blank means "all arms of this class", which
-- keeps existing assignment rows valid.
ALTER TABLE public.course_assignments
  ADD COLUMN IF NOT EXISTS class_arm_id uuid REFERENCES public.class_arms(id) ON DELETE SET NULL;

-- 5. RLS: Exam Officer gets the same day-to-day operational access as a
-- super admin over classes/arms, teacher assignments, and results — but
-- NOT over college_settings, user accounts, or payments. Written as
-- additive "OR" policies so existing super_admin/dept_admin policies are
-- untouched.
DO $$
BEGIN
  -- class_arms
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'class_arms' AND policyname = 'Exam officers manage class arms') THEN
    CREATE POLICY "Exam officers manage class arms" ON public.class_arms
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'exam_officer'))
      WITH CHECK (public.has_role(auth.uid(), 'exam_officer'));
  END IF;

  -- departments (class levels)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'departments' AND policyname = 'Exam officers manage class levels') THEN
    CREATE POLICY "Exam officers manage class levels" ON public.departments
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'exam_officer'))
      WITH CHECK (public.has_role(auth.uid(), 'exam_officer'));
  END IF;

  -- course_assignments (teacher + subject + class/arm)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'course_assignments' AND policyname = 'Exam officers manage assignments') THEN
    CREATE POLICY "Exam officers manage assignments" ON public.course_assignments
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'exam_officer'))
      WITH CHECK (public.has_role(auth.uid(), 'exam_officer'));
  END IF;

  -- results: exam officer can view/compile everything (approve, publish)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'results' AND policyname = 'Exam officers manage results') THEN
    CREATE POLICY "Exam officers manage results" ON public.results
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'exam_officer'))
      WITH CHECK (public.has_role(auth.uid(), 'exam_officer'));
  END IF;

  -- students: exam officer needs read access to build class rosters/report sheets
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'students' AND policyname = 'Exam officers view students') THEN
    CREATE POLICY "Exam officers view students" ON public.students
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'exam_officer'));
  END IF;

  -- lecturers (teachers): exam officer needs to see the teacher list to assign them
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lecturers' AND policyname = 'Exam officers view teachers') THEN
    CREATE POLICY "Exam officers view teachers" ON public.lecturers
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'exam_officer'));
  END IF;

  -- courses (subjects): exam officer needs to see/manage subjects to assign them
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'courses' AND policyname = 'Exam officers manage subjects') THEN
    CREATE POLICY "Exam officers manage subjects" ON public.courses
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'exam_officer'))
      WITH CHECK (public.has_role(auth.uid(), 'exam_officer'));
  END IF;

  -- attendance + report_card_comments: exam officer needs these for report sheets
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance' AND policyname = 'Exam officers view attendance') THEN
    CREATE POLICY "Exam officers view attendance" ON public.attendance
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'exam_officer'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_card_comments' AND policyname = 'Exam officers manage report card comments') THEN
    CREATE POLICY "Exam officers manage report card comments" ON public.report_card_comments
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'exam_officer'))
      WITH CHECK (public.has_role(auth.uid(), 'exam_officer'));
  END IF;
END $$;

-- 6. RLS: Admission Officer — narrow, enrollment-only access.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'students' AND policyname = 'Admission officers enroll students') THEN
    CREATE POLICY "Admission officers enroll students" ON public.students
      FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admission_officer'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'students' AND policyname = 'Admission officers view students') THEN
    CREATE POLICY "Admission officers view students" ON public.students
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admission_officer'));
  END IF;
  -- Admission officers need to read class levels/arms to put a pupil in one
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'class_arms' AND policyname = 'Admission officers view class arms') THEN
    CREATE POLICY "Admission officers view class arms" ON public.class_arms
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admission_officer'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'departments' AND policyname = 'Admission officers view class levels') THEN
    CREATE POLICY "Admission officers view class levels" ON public.departments
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admission_officer'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'faculties' AND policyname = 'Admission officers view school sections') THEN
    CREATE POLICY "Admission officers view school sections" ON public.faculties
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admission_officer'));
  END IF;
END $$;
