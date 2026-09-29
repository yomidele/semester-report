-- Public admissions: a visitor applies for a CLASS (department), not a
-- university "programme" — and the Admission Officer must actually be able
-- to see and act on what comes in. Two real bugs fixed here:
--
--   1. applications.programme_id was NOT NULL, tying every application to
--      the tertiary `programmes` table. A primary/secondary applicant is
--      applying to a class (public.departments — Primary 4, JSS1, etc.),
--      not a programme.
--   2. applicants/applications only had SELECT/UPDATE policies for
--      super_admin. The Admission Officer's own review page
--      (/admin/applications, guarded by ProtectedAdmissionOfficer) queries
--      these tables directly as the signed-in admission_officer — RLS was
--      silently returning zero rows to them. The page loaded; the queue was
--      just always empty. This is the same class of bug as the missing
--      teacher-visibility policies fixed earlier in this project.

ALTER TABLE public.applications ALTER COLUMN programme_id DROP NOT NULL;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id);
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS guardian_name text;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS guardian_phone text;

-- Every application must target either a class (the current, correct path)
-- or a legacy programme (old rows) — never neither.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_target_check') THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_target_check CHECK (department_id IS NOT NULL OR programme_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'applicants' AND policyname = 'Admission officers read applicants') THEN
    CREATE POLICY "Admission officers read applicants" ON public.applicants
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admission_officer'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'applicants' AND policyname = 'Admission officers update applicants') THEN
    CREATE POLICY "Admission officers update applicants" ON public.applicants
      FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'admission_officer'))
      WITH CHECK (public.has_role(auth.uid(), 'admission_officer'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'applications' AND policyname = 'Admission officers read applications') THEN
    CREATE POLICY "Admission officers read applications" ON public.applications
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admission_officer'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'applications' AND policyname = 'Admission officers update applications') THEN
    CREATE POLICY "Admission officers update applications" ON public.applications
      FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'admission_officer'))
      WITH CHECK (public.has_role(auth.uid(), 'admission_officer'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Public admissions on/off switch, toggleable by Super Admin AND Admission
-- Officer (see setAdmissionsOpen in src/lib/applicant.functions.ts — a
-- dedicated server function rather than a broad RLS grant, so the Admission
-- Officer can flip this one switch without gaining write access to the rest
-- of college_settings: grading scale, matric format, Result PIN pricing,
-- Paystack keys, etc.).
-- ---------------------------------------------------------------------------
ALTER TABLE public.college_settings ADD COLUMN IF NOT EXISTS admissions_open boolean NOT NULL DEFAULT true;
