-- The frontend (src/hooks/use-role.ts) already references an "exam_officer"
-- and an "admission_officer" role (isExamOfficer / isAdmissionOfficer), but
-- neither value existed on the app_role enum, so those checks could never
-- be true for any real user. This adds the two missing enum values.
--
-- Kept as its own migration: Postgres does not allow a newly added enum
-- value to be referenced by other statements in the same transaction it
-- was added in, so the RLS policies that use these roles live in the next
-- migration file instead.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'exam_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admission_officer';
