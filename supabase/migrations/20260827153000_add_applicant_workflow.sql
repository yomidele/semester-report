CREATE TABLE public.applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_number text NOT NULL UNIQUE DEFAULT ('APP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  gender text,
  date_of_birth date,
  address text,
  state_of_origin text,
  qualification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  programme_id uuid NOT NULL REFERENCES public.programmes(id),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'admitted', 'rejected')),
  notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  converted_student_id uuid REFERENCES public.students(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_status ON public.applications(status);
CREATE INDEX idx_applications_applicant ON public.applications(applicant_id);
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.applicants, public.applications TO anon;
GRANT SELECT, INSERT, UPDATE ON public.applicants, public.applications TO authenticated;
GRANT ALL ON public.applicants, public.applications TO service_role;

CREATE POLICY "Anyone can submit applicant details" ON public.applicants FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Super admins read applicants" ON public.applicants FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins update applicants" ON public.applicants FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Anyone can submit applications" ON public.applications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Super admins read applications" ON public.applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins update applications" ON public.applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_applicants_updated BEFORE UPDATE ON public.applicants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
