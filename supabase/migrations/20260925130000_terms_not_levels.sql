-- This school runs three terms (First, Second, Third), not two university
-- semesters, and subjects/classes here don't have a numeric "level" the way
-- a university course does (see 20260915120000_simplify_subjects.sql,
-- which already dropped level/semester from courses for the same reason).
-- results.semester and results.level are still NOT NULL from the original
-- university-style schema though, which blocks:
--   - recording/downloading a Third Term result at all if a CHECK
--     constraint on results.semester only allows two values, and
--   - saving any result at all now that courses no longer carry a level,
--     since results.level is NOT NULL with nothing left to populate it
--     from (src/routes/lecturer.entry.tsx and friends used to read
--     course.level, which is now always null).
--
-- Fix both without touching anything else about the results table: widen
-- whatever CHECK constraint exists on semester (found dynamically, since
-- its exact name isn't in any migration in this repo — it predates them),
-- and make level optional with a harmless default so old NOT NULL inserts
-- and new level-less ones both work.

DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.results'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%semester%'
  LOOP
    EXECUTE format('ALTER TABLE public.results DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.results
  ADD CONSTRAINT results_semester_check CHECK (semester IN ('First', 'Second', 'Third'));

ALTER TABLE public.results ALTER COLUMN level SET DEFAULT 0;
ALTER TABLE public.results ALTER COLUMN level DROP NOT NULL;

-- Same story for students.level — required historically for a
-- 100/200/300/400 university level, no longer meaningful once a pupil is
-- placed in a class_arm instead. Make it optional too so student creation
-- doesn't need a fake level value.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'level'
  ) THEN
    ALTER TABLE public.students ALTER COLUMN level SET DEFAULT 0;
    ALTER TABLE public.students ALTER COLUMN level DROP NOT NULL;
  END IF;
END $$;
