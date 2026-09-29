-- The app (src/lib/college-settings.ts, src/lib/applicant.functions.ts,
-- src/components/AdmissionsToggle.tsx) already reads and writes
-- college_settings.admissions_open — a Super Admin / Admission Officer
-- switch that opens or closes the public /apply form — but no migration
-- ever created the column, so every one of those queries fails against a
-- real database. This adds it, defaulting to open so existing installs
-- behave exactly as before until someone flips the switch.

ALTER TABLE public.college_settings
  ADD COLUMN IF NOT EXISTS admissions_open boolean NOT NULL DEFAULT true;
