CREATE TABLE public.student_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.academic_sessions(id),
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  receipt_number text UNIQUE,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'part_paid')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.timetables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid REFERENCES public.faculties(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  level integer NOT NULL,
  semester text NOT NULL CHECK (semester IN ('FIRST', 'SECOND')),
  day text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  course_code text NOT NULL,
  course_title text NOT NULL,
  venue text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'students', 'staff')),
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.student_fees, public.timetables, public.announcements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.student_fees, public.timetables, public.announcements TO authenticated;
GRANT ALL ON public.student_fees, public.timetables, public.announcements TO service_role;

CREATE POLICY "Students view own fees" ON public.student_fees FOR SELECT TO authenticated USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
CREATE POLICY "Super admins manage fees" ON public.student_fees FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Students view own timetable" ON public.timetables FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.students s WHERE s.user_id = auth.uid() AND s.faculty_id = timetables.faculty_id AND s.department_id = timetables.department_id AND s.level = timetables.level));
CREATE POLICY "Admins manage timetables" ON public.timetables FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'faculty_admin') OR public.has_role(auth.uid(), 'dept_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'faculty_admin') OR public.has_role(auth.uid(), 'dept_admin'));
CREATE POLICY "Students view published announcements" ON public.announcements FOR SELECT TO authenticated USING (published = true AND audience IN ('all', 'students'));
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'faculty_admin') OR public.has_role(auth.uid(), 'dept_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'faculty_admin') OR public.has_role(auth.uid(), 'dept_admin'));
