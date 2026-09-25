-- Lets the Subjects admin page say "these classes take this subject" by
-- multi-select, without requiring a teacher to already be assigned (that's
-- what course_assignments is for — it needs a lecturer_id). This table is a
-- plain many-to-many: one subject can be ticked for many class arms, and one
-- class arm can have many subjects.

CREATE TABLE IF NOT EXISTS public.class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_arm_id uuid NOT NULL REFERENCES public.class_arms(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_arm_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_class_subjects_class_arm ON public.class_subjects (class_arm_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_course ON public.class_subjects (course_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_subjects TO authenticated;
GRANT ALL ON public.class_subjects TO service_role;

ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'class_subjects' AND policyname = 'Staff manage class subjects') THEN
    CREATE POLICY "Staff manage class subjects" ON public.class_subjects
      FOR ALL TO authenticated
      USING (
        public.has_role(auth.uid(), 'super_admin')
        OR public.has_role(auth.uid(), 'exam_officer')
        OR public.has_role(auth.uid(), 'faculty_admin')
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'super_admin')
        OR public.has_role(auth.uid(), 'exam_officer')
        OR public.has_role(auth.uid(), 'faculty_admin')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'class_subjects' AND policyname = 'Teachers view class subjects') THEN
    CREATE POLICY "Teachers view class subjects" ON public.class_subjects
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'lecturer'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Offline attendance sync support.
--
-- The form-master Attendance page (src/routes/lecturer.attendance.tsx) marks
-- attendance from an IndexedDB queue while offline and flushes it to this
-- table once connectivity returns, via a plain upsert on the existing unique
-- key (student_id, session_id, term, attendance_date). No schema change is
-- needed for that — the table already supports it — but a device syncing a
-- backlog of rows for pupils no longer in that class needs to be able to
-- read the class roster it cached, so make sure teachers can select the
-- class_arms and students of the class(es) they form-master.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'students' AND policyname = 'Form masters view their class roster') THEN
    CREATE POLICY "Form masters view their class roster" ON public.students
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.class_arms ca
          JOIN public.lecturers l ON l.id = ca.form_teacher_id
          WHERE ca.id = students.class_arm_id AND l.user_id = auth.uid()
        )
      );
  END IF;
END $$;
