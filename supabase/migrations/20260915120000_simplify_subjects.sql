-- The Subjects page (src/routes/courses.tsx, table: public.courses) still
-- required every subject to have a college-style numeric level (100/200/
-- 300/400), a semester, and a credit "unit" weight — none of which make
-- sense for a primary school, where the same subject (e.g. Mathematics) is
-- taught across every class, not tied to one specific level or term.
--
-- This also caused a real, live bug: lecturer.entry.tsx filtered the
-- pupils shown to a teacher by matching students.level to the assigned
-- course's level. Every pupil created by enrollStudent/bulkEnrollStudents
-- is given level = 1 (primary pupils don't have a college-style level), but
-- subjects created through the old Subjects page defaulted to level = 100.
-- That mismatch meant a teacher's score-entry list could come back
-- completely empty. Fixed in the matching code change to
-- src/routes/lecturer.entry.tsx (this migration only touches the schema).

ALTER TABLE public.courses ALTER COLUMN level DROP NOT NULL;
ALTER TABLE public.courses ALTER COLUMN semester DROP NOT NULL;
ALTER TABLE public.courses ALTER COLUMN unit SET DEFAULT 1;
