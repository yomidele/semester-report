-- Primary-school foundation for Model Day Primary School Kazaure
ALTER TABLE public.academic_settings
  ADD COLUMN IF NOT EXISTS current_term text NOT NULL DEFAULT 'First';

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS arm text;

CREATE TABLE IF NOT EXISTS public.class_arms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_arms TO authenticated;
GRANT ALL ON public.class_arms TO service_role;
ALTER TABLE public.class_arms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view class arms" ON public.class_arms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage class arms" ON public.class_arms
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_class_arms_updated') THEN
    CREATE TRIGGER trg_class_arms_updated
      BEFORE UPDATE ON public.class_arms
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_arm_id uuid REFERENCES public.class_arms(id) ON DELETE SET NULL,
  session_id uuid NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  term text NOT NULL,
  attendance_date date NOT NULL,
  status text NOT NULL DEFAULT 'present',
  notes text,
  marked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, session_id, term, attendance_date),
  CONSTRAINT attendance_status_valid CHECK (status IN ('present', 'absent', 'late', 'excused'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School staff manage attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'lecturer'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'lecturer'));
CREATE POLICY "Students view their attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendance.student_id AND s.user_id = auth.uid()));
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_attendance_updated') THEN
    CREATE TRIGGER trg_attendance_updated
      BEFORE UPDATE ON public.attendance
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.report_card_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  term text NOT NULL,
  class_teacher_comment text,
  head_teacher_comment text,
  conduct_rating text,
  attendance_summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, session_id, term)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_card_comments TO authenticated;
GRANT ALL ON public.report_card_comments TO service_role;
ALTER TABLE public.report_card_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School staff manage report card comments" ON public.report_card_comments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'lecturer'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'lecturer'));
CREATE POLICY "Students view their report card comments" ON public.report_card_comments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = report_card_comments.student_id AND s.user_id = auth.uid()));
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_report_card_comments_updated') THEN
    CREATE TRIGGER trg_report_card_comments_updated
      BEFORE UPDATE ON public.report_card_comments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- School identity and primary-school grading.
UPDATE public.college_settings
SET college_name = 'Model Day Primary School Kazaure',
    short_name = 'MDPSK',
    motto = 'Learn Today, Lead Tomorrow',
    address = 'Kazaure',
    state = 'Jigawa',
    matric_format = '{CLASS}/{YY}/{SEQ}',
    grading_scale = '[{"grade":"A","min":75,"point":0,"remark":"Excellent"},{"grade":"B","min":65,"point":0,"remark":"Very Good"},{"grade":"C","min":55,"point":0,"remark":"Good"},{"grade":"D","min":45,"point":0,"remark":"Pass"},{"grade":"E","min":40,"point":0,"remark":"Needs Improvement"},{"grade":"F","min":0,"point":0,"remark":"Fail"}]'::jsonb,
    pass_mark = 40,
    use_gpa = false,
    result_settings = '{"assessment_label":"Continuous Assessment","final_assessment_label":"Examination","term_names":["First","Second","Third"]}'::jsonb,
    report_card_settings = '{"show_gpa":false,"show_units":false,"show_attendance":true,"show_comments":true}'::jsonb
WHERE id = (SELECT id FROM public.college_settings ORDER BY updated_at DESC LIMIT 1);

INSERT INTO public.college_settings (
  college_name, short_name, motto, address, state, matric_format,
  grading_scale, pass_mark, use_gpa, result_settings, report_card_settings
)
SELECT
  'Model Day Primary School Kazaure', 'MDPSK', 'Learn Today, Lead Tomorrow', 'Kazaure', 'Jigawa', '{CLASS}/{YY}/{SEQ}',
  '[{"grade":"A","min":75,"point":0,"remark":"Excellent"},{"grade":"B","min":65,"point":0,"remark":"Very Good"},{"grade":"C","min":55,"point":0,"remark":"Good"},{"grade":"D","min":45,"point":0,"remark":"Pass"},{"grade":"E","min":40,"point":0,"remark":"Needs Improvement"},{"grade":"F","min":0,"point":0,"remark":"Fail"}]'::jsonb,
  40, false,
  '{"assessment_label":"Continuous Assessment","final_assessment_label":"Examination","term_names":["First","Second","Third"]}'::jsonb,
  '{"show_gpa":false,"show_units":false,"show_attendance":true,"show_comments":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.college_settings);

-- Seed the school structure without replacing existing records.
INSERT INTO public.faculties (id, name, code, is_active, description)
SELECT '41111111-1111-4111-8111-111111111111', 'Lower Primary', 'LOWER', true, 'Primary 1 to Primary 3'
WHERE NOT EXISTS (SELECT 1 FROM public.faculties WHERE code = 'LOWER');
INSERT INTO public.faculties (id, name, code, is_active, description)
SELECT '42222222-2222-4222-8222-222222222222', 'Upper Primary', 'UPPER', true, 'Primary 4 to Primary 6'
WHERE NOT EXISTS (SELECT 1 FROM public.faculties WHERE code = 'UPPER');

INSERT INTO public.departments (id, faculty_id, name, code, is_active, description)
SELECT v.id, v.faculty_id, v.name, v.code, true, v.description
FROM (VALUES
  ('43111111-1111-4111-8111-111111111111'::uuid, '41111111-1111-4111-8111-111111111111'::uuid, 'Primary 1', 'PRI1', 'Primary 1 class'),
  ('43222222-2222-4222-8222-222222222222'::uuid, '41111111-1111-4111-8111-111111111111'::uuid, 'Primary 2', 'PRI2', 'Primary 2 class'),
  ('43333333-3333-4333-8333-333333333333'::uuid, '41111111-1111-4111-8111-111111111111'::uuid, 'Primary 3', 'PRI3', 'Primary 3 class'),
  ('43444444-4444-4444-8444-444444444444'::uuid, '42222222-2222-4222-8222-222222222222'::uuid, 'Primary 4', 'PRI4', 'Primary 4 class'),
  ('43555555-5555-4555-8555-555555555555'::uuid, '42222222-2222-4222-8222-222222222222'::uuid, 'Primary 5', 'PRI5', 'Primary 5 class'),
  ('43666666-6666-4666-8666-666666666666'::uuid, '42222222-2222-4222-8222-222222222222'::uuid, 'Primary 6', 'PRI6', 'Primary 6 class')
) AS v(id, faculty_id, name, code, description)
WHERE NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.code = v.code);

INSERT INTO public.class_arms (id, department_id, name, code)
SELECT v.id, v.department_id, v.name, v.code
FROM (VALUES
  ('44111111-1111-4111-8111-111111111111'::uuid, '43111111-1111-4111-8111-111111111111'::uuid, 'Arm A', 'A'),
  ('44111111-1111-4111-8111-111111111112'::uuid, '43111111-1111-4111-8111-111111111111'::uuid, 'Arm B', 'B'),
  ('44222222-2222-4222-8222-222222222221'::uuid, '43222222-2222-4222-8222-222222222222'::uuid, 'Arm A', 'A'),
  ('44222222-2222-4222-8222-222222222222'::uuid, '43222222-2222-4222-8222-222222222222'::uuid, 'Arm B', 'B'),
  ('44333333-3333-4333-8333-333333333331'::uuid, '43333333-3333-4333-8333-333333333333'::uuid, 'Arm A', 'A'),
  ('44333333-3333-4333-8333-333333333332'::uuid, '43333333-3333-4333-8333-333333333333'::uuid, 'Arm B', 'B'),
  ('44444444-4444-4444-8444-444444444441'::uuid, '43444444-4444-4444-8444-444444444444'::uuid, 'Arm A', 'A'),
  ('44444444-4444-4444-8444-444444444442'::uuid, '43444444-4444-4444-8444-444444444444'::uuid, 'Arm B', 'B'),
  ('44555555-5555-4555-8555-555555555551'::uuid, '43555555-5555-4555-8555-555555555555'::uuid, 'Arm A', 'A'),
  ('44555555-5555-4555-8555-555555555552'::uuid, '43555555-5555-4555-8555-555555555555'::uuid, 'Arm B', 'B'),
  ('44666666-6666-4666-8666-666666666661'::uuid, '43666666-6666-4666-8666-666666666666'::uuid, 'Arm A', 'A'),
  ('44666666-6666-4666-8666-666666666662'::uuid, '43666666-6666-4666-8666-666666666666'::uuid, 'Arm B', 'B')
) AS v(id, department_id, name, code)
WHERE NOT EXISTS (SELECT 1 FROM public.class_arms a WHERE a.department_id = v.department_id AND a.code = v.code);

-- Academic session and term defaults.
INSERT INTO public.academic_sessions (id, name)
SELECT '45111111-1111-4111-8111-111111111111', '2026/2027'
WHERE NOT EXISTS (SELECT 1 FROM public.academic_sessions WHERE name = '2026/2027');
INSERT INTO public.academic_settings (current_session_id, current_term)
SELECT '45111111-1111-4111-8111-111111111111', 'First'
WHERE NOT EXISTS (SELECT 1 FROM public.academic_settings);
UPDATE public.academic_settings
SET current_session_id = COALESCE(current_session_id, '45111111-1111-4111-8111-111111111111'),
    current_term = COALESCE(NULLIF(current_term, ''), 'First');

-- Core subjects for Primary 1–6. The legacy unit field remains for compatibility and is not shown as a credit.
INSERT INTO public.courses (code, title, unit, level, semester, faculty_id, department_id, course_type)
SELECT
  'P' || right(d.code, 1) || '-' || s.code,
  s.title,
  1,
  (right(d.code, 1)::integer) * 100,
  'First',
  d.faculty_id,
  d.id,
  'core'
FROM public.departments d
CROSS JOIN (VALUES
  ('ENG', 'English Studies'),
  ('MTH', 'Mathematics'),
  ('BSC', 'Basic Science'),
  ('CIV', 'Civic Education'),
  ('HPE', 'Health and Physical Education'),
  ('CRS', 'Religious and Moral Instruction')
) AS s(code, title)
WHERE d.code IN ('PRI1','PRI2','PRI3','PRI4','PRI5','PRI6')
  AND NOT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.code = 'P' || right(d.code, 1) || '-' || s.code
  );

CREATE INDEX IF NOT EXISTS idx_attendance_student_term ON public.attendance (student_id, session_id, term);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_report_card_comments_student ON public.report_card_comments (student_id, session_id, term);
CREATE INDEX IF NOT EXISTS idx_class_arms_department ON public.class_arms (department_id);