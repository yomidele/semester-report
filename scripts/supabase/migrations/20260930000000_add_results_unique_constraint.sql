-- Both the admin bulk entry grid (src/components/ResultsEntryGrid.tsx) and
-- the teacher entry page (src/routes/lecturer.entry.tsx) upsert into
-- `results` with:
--   .upsert(rows, { onConflict: "student_id,course_id,session_id,semester" })
--
-- Postgres/PostgREST can only resolve an ON CONFLICT target against a real
-- unique or exclusion constraint (or unique index) on those exact columns —
-- one was never created for `results`, so every save fails with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
--
-- Because that constraint never existed, it's possible for a student to
-- already have more than one row for the same course/session/semester from
-- before (e.g. two manual inserts, or an earlier plain .insert() attempt).
-- Deduplicate first — keeping the most recently updated row and deleting the
-- rest — or adding the constraint below would fail with a duplicate-key
-- error on whatever data is already there.
DELETE FROM public.results r
USING public.results dupe
WHERE r.student_id = dupe.student_id
  AND r.course_id = dupe.course_id
  AND r.session_id = dupe.session_id
  AND r.semester = dupe.semester
  AND (
    r.updated_at < dupe.updated_at
    OR (r.updated_at = dupe.updated_at AND r.id < dupe.id)
  );

ALTER TABLE public.results
  ADD CONSTRAINT results_student_course_session_semester_key
  UNIQUE (student_id, course_id, session_id, semester);
