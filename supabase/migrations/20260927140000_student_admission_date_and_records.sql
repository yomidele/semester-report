-- Support for two new screens:
--   1. Super Admin → "Student Records" (search a pupil, see their whole
--      history, download any past term's report card).
--   2. Admission Officer → "Admission Records" (search a pupil, see when
--      they were admitted, re-download their admission letter).
--
-- Problem this fixes: enrollStudent() has always computed an admission_date
-- (`new Date().toISOString()`) and handed it straight back to the browser so
-- the officer could generate the letter immediately after enrolling — but
-- that value was never saved anywhere. Once the browser tab closed, there
-- was no durable record of "when was this pupil admitted", and no way to
-- regenerate the admission letter later without guessing at `created_at`
-- (which is a generic audit column, not a documented admission date, and
-- isn't guaranteed to stay untouched by future bulk-import/migration tools).
--
-- This migration adds a first-class `admission_date` column, backfills it
-- from `created_at` for every pupil already on record (their `created_at`
-- *is* the moment they were enrolled, for every pupil enrolled to date), and
-- indexes it for the new records screens.

-- 1. Add the column without a default first, so the backfill below can tell
--    a genuinely-new row from an existing one (both would otherwise get
--    "now" if DEFAULT now() were applied before the backfill ran).
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS admission_date timestamptz;

-- 2. Backfill: every existing pupil's created_at is their true admission
--    moment (this table has never had any other insert path).
UPDATE public.students
SET admission_date = created_at
WHERE admission_date IS NULL;

-- 3. Now that every existing row is filled in, default and require it for
--    every future insert (enrollStudent / bulkEnrollStudents set it
--    explicitly, but the default keeps any other insert path honest too).
ALTER TABLE public.students
  ALTER COLUMN admission_date SET DEFAULT now(),
  ALTER COLUMN admission_date SET NOT NULL;

-- 4. The two new records screens both search-then-select a single pupil and
--    then sort/filter by when they were admitted (Admission Records lists
--    recent admissions; Student Records can be scanned by admission date).
CREATE INDEX IF NOT EXISTS idx_students_admission_date ON public.students (admission_date);

COMMENT ON COLUMN public.students.admission_date IS
  'When this pupil was admitted/enrolled. Set once at enrollment and never changed afterwards — this is what the admission letter and the admission/records screens show, independent of created_at.';
