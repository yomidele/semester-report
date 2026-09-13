-- Primary-school completion pass.
--
-- Problem this fixes: class_arms (e.g. "4A"/"4B") existed as a table but
-- nothing in the app actually referenced it — students weren't linked to a
-- specific arm, course_assignments could only target a whole class level
-- (department), and there was no way to name a form master for an arm.
-- There was also no role that could assign teachers/compile results across
-- ALL classes (exam_officer) or one that could enrol a new pupil and issue
-- an admission letter without going through the old public
-- "apply to the college" flow (admission_officer).

-- 1. Form master: one teacher can be named responsible for a class arm.
ALTER TABLE public.class_arms
  ADD COLUMN IF NOT EXISTS form_teacher_id uuid REFERENCES public.lecturers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_arms_form_teacher ON public.class_arms(form_teacher_id);

-- 2. Students belong to a specific arm, not just a class level.
--    Nullable on purpose: existing students pre-date this column and can be
--    backfilled by the exam officer from the new Classes & Arms screen.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS class_arm_id uuid REFERENCES public.class_arms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_class_arm ON public.students(class_arm_id);

-- 3. A subject assignment can now target one specific arm (e.g. "Mrs Bello
--    teaches Maths to 4A only") instead of only the whole class level. Left
--    nullable so an assignment with no arm still means "the whole class
--    level", matching the existing dept-admin behaviour.
ALTER TABLE public.course_assignments
  ADD COLUMN IF NOT EXISTS class_arm_id uuid REFERENCES public.class_arms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_course_assignments_class_arm ON public.course_assignments(class_arm_id);

-- 4. Exam officer: school-wide equivalent of a department admin, but not
--    scoped to one department. Can manage the class/arm structure, assign
--    teachers to classes+subjects anywhere in the school, and compile/
--    approve results anywhere in the school.
CREATE POLICY "Exam officers manage class arms" ON public.class_arms
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'exam_officer') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'exam_officer') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Exam officers manage course assignments" ON public.course_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'exam_officer') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'exam_officer') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Exam officers read faculties" ON public.faculties
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'exam_officer'));

CREATE POLICY "Exam officers read departments" ON public.departments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'exam_officer'));

CREATE POLICY "Exam officers manage departments" ON public.departments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'exam_officer'))
  WITH CHECK (public.has_role(auth.uid(), 'exam_officer'));

CREATE POLICY "Exam officers read lecturers" ON public.lecturers
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'exam_officer'));

CREATE POLICY "Exam officers read courses" ON public.courses
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'exam_officer'));

CREATE POLICY "Exam officers read students" ON public.students
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'exam_officer'));

CREATE POLICY "Exam officers manage results" ON public.results
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'exam_officer'))
  WITH CHECK (public.has_role(auth.uid(), 'exam_officer'));

-- report_card_comments previously allowed super_admin/teacher/lecturer only;
-- the exam officer compiles report sheets too and needs the same access.
CREATE POLICY "Exam officers manage report card comments" ON public.report_card_comments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'exam_officer'))
  WITH CHECK (public.has_role(auth.uid(), 'exam_officer'));

CREATE POLICY "Exam officers manage attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'exam_officer'))
  WITH CHECK (public.has_role(auth.uid(), 'exam_officer'));

-- 5. Admission officer: can enrol a pupil (insert a student row + read the
--    class/arm list to place them) and look up students to reprint a letter.
--    Deliberately NOT given access to results.
CREATE POLICY "Admission officers read faculties" ON public.faculties
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admission_officer'));

CREATE POLICY "Admission officers read departments" ON public.departments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admission_officer'));

CREATE POLICY "Admission officers read class arms" ON public.class_arms
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admission_officer'));

CREATE POLICY "Admission officers read students" ON public.students
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admission_officer'));

-- Note: the actual INSERT of a new student happens through the
-- enrollStudent server function using the service-role client
-- (supabaseAdmin), the same pattern already used by registerStudentWithToken
-- and createFacultyAdmin — so no client-side INSERT policy is required for
-- admission_officer here.
