-- The public application form (src/routes/apply.tsx) now requires a
-- passport photograph (via the shared PhotoCaptureInput component, which
-- rejects anything that isn't roughly passport-shaped before it's ever
-- uploaded). submitApplication (src/lib/applicant.functions.ts) uploads it
-- to the existing "passports" storage bucket and stores the public URL
-- here, the same pattern enrollStudent already uses for enrolled pupils.
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS photo_url text;
