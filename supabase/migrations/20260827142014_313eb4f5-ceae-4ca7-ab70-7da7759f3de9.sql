-- =============== PROGRAMMES ===============
CREATE TABLE public.programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES public.faculties(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  award text NOT NULL DEFAULT 'National Diploma',
  duration_years integer NOT NULL DEFAULT 2 CHECK (duration_years BETWEEN 1 AND 6),
  uses_gpa boolean NOT NULL DEFAULT true,
  min_units integer NOT NULL DEFAULT 12,
  max_units integer NOT NULL DEFAULT 24,
  description text,
  requirements text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.programmes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programmes TO authenticated;
GRANT ALL ON public.programmes TO service_role;
ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active programmes" ON public.programmes
  FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated staff can view all programmes" ON public.programmes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manages programmes" ON public.programmes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_programmes_updated BEFORE UPDATE ON public.programmes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== COLLEGE SETTINGS ===============
CREATE TABLE public.college_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_name text NOT NULL DEFAULT 'College of Health Technology',
  short_name text NOT NULL DEFAULT 'COHT',
  motto text,
  logo_url text,
  address text,
  city text,
  state text,
  phone text,
  email text,
  website text,
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  matric_format text NOT NULL DEFAULT '{DEPT}/{YY}/{SEQ}',
  matric_seq_padding integer NOT NULL DEFAULT 4,
  grading_scale jsonb NOT NULL DEFAULT '[]'::jsonb,
  pass_mark numeric NOT NULL DEFAULT 40,
  use_gpa boolean NOT NULL DEFAULT true,
  result_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_card_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  pin_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.college_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.college_settings TO authenticated;
GRANT ALL ON public.college_settings TO service_role;
ALTER TABLE public.college_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view college settings" ON public.college_settings
  FOR SELECT USING (true);
CREATE POLICY "Super admin updates college settings" ON public.college_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin inserts college settings" ON public.college_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_college_settings_updated BEFORE UPDATE ON public.college_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== AUDIT LOGS ===============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  faculty_id uuid,
  department_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin reads audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "School admin reads own school audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'faculty_admin') AND faculty_id = public.current_faculty_id());
CREATE POLICY "Authenticated users write audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE INDEX idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);

-- =============== PROGRAMME LINKS ON EXISTING TABLES ===============
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS programme_id uuid REFERENCES public.programmes(id);
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS programme_id uuid REFERENCES public.programmes(id);
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS programme_id uuid REFERENCES public.programmes(id);
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS programme_id uuid REFERENCES public.programmes(id);

CREATE INDEX IF NOT EXISTS idx_students_programme ON public.students (programme_id);
CREATE INDEX IF NOT EXISTS idx_courses_programme ON public.courses (programme_id);

-- =============== PROGRAMME-AWARE PROMOTION ===============
CREATE OR REPLACE FUNCTION public.promote_students_to_session(new_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prev_session_id uuid;
  new_session_created timestamptz;
  has_any_records boolean;
BEGIN
  SELECT created_at INTO new_session_created FROM public.academic_sessions WHERE id = new_session_id;
  IF new_session_created IS NULL THEN RETURN; END IF;

  SELECT id INTO prev_session_id
  FROM public.academic_sessions
  WHERE created_at < new_session_created
  ORDER BY created_at DESC LIMIT 1;

  SELECT EXISTS(SELECT 1 FROM public.student_academic_records) INTO has_any_records;

  IF prev_session_id IS NULL OR NOT has_any_records THEN
    INSERT INTO public.student_academic_records (student_id, academic_session_id, level, status, has_carryover)
    SELECT s.id, new_session_id, s.level, 'active', false
    FROM public.students s
    ON CONFLICT (student_id, academic_session_id) DO NOTHING;
    RETURN;
  END IF;

  -- Promote students who are below their programme's final level
  INSERT INTO public.student_academic_records (student_id, academic_session_id, level, status, has_carryover)
  SELECT sar.student_id, new_session_id, sar.level + 100, 'active', false
  FROM public.student_academic_records sar
  JOIN public.students s ON s.id = sar.student_id
  LEFT JOIN public.programmes p ON p.id = s.programme_id
  WHERE sar.academic_session_id = prev_session_id
    AND sar.status IN ('active', 'carryover')
    AND sar.level < COALESCE(p.duration_years, 4) * 100
  ON CONFLICT (student_id, academic_session_id) DO NOTHING;

  -- Final-level students with carryovers repeat the final level
  INSERT INTO public.student_academic_records (student_id, academic_session_id, level, status, has_carryover)
  SELECT sar.student_id, new_session_id, sar.level, 'carryover', true
  FROM public.student_academic_records sar
  JOIN public.students s ON s.id = sar.student_id
  LEFT JOIN public.programmes p ON p.id = s.programme_id
  WHERE sar.academic_session_id = prev_session_id
    AND sar.status IN ('active', 'carryover')
    AND sar.level >= COALESCE(p.duration_years, 4) * 100
    AND sar.has_carryover = true
  ON CONFLICT (student_id, academic_session_id) DO NOTHING;

  -- Final-level students with no carryover graduate
  UPDATE public.student_academic_records sar
  SET status = 'graduated'
  FROM public.students s
  LEFT JOIN public.programmes p ON p.id = s.programme_id
  WHERE s.id = sar.student_id
    AND sar.academic_session_id = prev_session_id
    AND sar.level >= COALESCE(p.duration_years, 4) * 100
    AND sar.has_carryover = false
    AND sar.status = 'active';
END;
$function$;

-- =============== SEED: SETTINGS, SCHOOLS, DEPARTMENTS, PROGRAMMES ===============
INSERT INTO public.college_settings (
  college_name, short_name, motto, address, city, state, phone, email, website,
  matric_format, grading_scale, pass_mark, use_gpa
) VALUES (
  'Shallom College of Health Technology', 'SCHT',
  'Knowledge, Service, Compassion',
  'Pambula Michika, Adamawa State', 'Michika', 'Adamawa',
  '+234 803 000 0000', 'info@schealthtech.edu.ng', 'https://schealthtech.edu.ng',
  '{DEPT}/{YY}/{SEQ}',
  '[{"grade":"A","min":70,"point":5,"remark":"Excellent"},
    {"grade":"B","min":60,"point":4,"remark":"Very Good"},
    {"grade":"C","min":50,"point":3,"remark":"Good"},
    {"grade":"D","min":45,"point":2,"remark":"Pass"},
    {"grade":"E","min":40,"point":1,"remark":"Weak Pass"},
    {"grade":"F","min":0,"point":0,"remark":"Fail"}]'::jsonb,
  40, true
);

INSERT INTO public.faculties (id, name, code) VALUES
  ('11111111-1111-4111-8111-111111111111', 'School of Health Technology', 'SHT'),
  ('22222222-2222-4222-8222-222222222222', 'School of Medical Laboratory Sciences', 'SMLS'),
  ('33333333-3333-4333-8333-333333333333', 'School of Nursing Sciences', 'SNS')
ON CONFLICT DO NOTHING;

INSERT INTO public.departments (id, faculty_id, name, code) VALUES
  ('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Community Health', 'CHW'),
  ('a2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Environmental Health', 'EHT'),
  ('a3333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Health Information Management', 'HIM'),
  ('b1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Medical Laboratory Technology', 'MLT'),
  ('c1111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Nursing', 'NUR')
ON CONFLICT DO NOTHING;

INSERT INTO public.programmes (faculty_id, department_id, name, code, award, duration_years, uses_gpa, description, requirements) VALUES
  ('11111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','Junior Community Health Extension Worker','JCHEW','Certificate',2,true,'Trains frontline community health extension workers for primary healthcare centres.','SSCE/NECO with credit passes in English, Biology and two other subjects.'),
  ('11111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','Community Health Extension Worker','CHEW','National Diploma',3,true,'Advanced community health training with clinical and field postings.','SSCE/NECO with 5 credits including English, Mathematics, Biology and Chemistry.'),
  ('11111111-1111-4111-8111-111111111111','a2222222-2222-4222-8222-222222222222','Environmental Health Technician','EHT-T','Certificate',2,true,'Public health inspection, sanitation and disease vector control.','SSCE/NECO with credits in English, Biology and Chemistry.'),
  ('11111111-1111-4111-8111-111111111111','a3333333-3333-4333-8333-333333333333','Health Information Management','HIM-ND','National Diploma',3,true,'Medical records, health data coding and health informatics.','SSCE/NECO with 5 credits including English and Mathematics.'),
  ('22222222-2222-4222-8222-222222222222','b1111111-1111-4111-8111-111111111111','Medical Laboratory Technician','MLT-T','National Diploma',3,true,'Laboratory diagnostics, haematology, microbiology and chemical pathology.','SSCE/NECO with credits in English, Mathematics, Biology, Chemistry and Physics.'),
  ('33333333-3333-4333-8333-333333333333','c1111111-1111-4111-8111-111111111111','Basic Nursing','RN-BN','Registered Nurse',4,true,'Professional nursing training with hospital clinical postings.','SSCE/NECO with 5 credits including English, Mathematics, Biology, Chemistry and Physics.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.academic_sessions (name) VALUES ('2025/2026') ON CONFLICT DO NOTHING;