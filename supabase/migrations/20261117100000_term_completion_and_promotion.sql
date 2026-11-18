-- Student promotion after a completed academic session.
--
-- Before this migration, promote_primary_students() ran automatically the
-- moment ANY new academic session was created (trigger
-- trg_academic_sessions_promote_primary). Nothing checked that the old
-- session's three terms were finished, nobody reviewed the list first, and
-- creating a session by mistake promoted the whole school.
--
-- After this migration:
--   1. Each session records when its First, Second and Third terms were
--      completed and when the session was closed (in that order).
--   2. Promotion no longer fires on session creation. The Super Admin runs
--      it from Student Promotion, and only for a session whose three terms
--      are complete AND which has been closed.
--   3. Who is eligible follows a configurable school policy
--      (college_settings.promotion_settings) — no pass mark is invented.
--      Pupils whose eligibility can't be established are listed for review,
--      never promoted silently.
--   4. Every promotion, repeat or programme completion is a permanent row in
--      student_class_history (extended below). A pupil can be processed only
--      once per completed session; a mistake is undone with
--      reverse_promotion(), which marks the row "reversed" — it is never
--      deleted.
--   5. Nothing here deletes or rewrites results, attendance, report
--      comments, admission numbers or profiles. Only a pupil's *current*
--      class (students.department_id / class_arm_id / faculty_id) and, for
--      pupils completing the programme, their status are updated.

-- 1. Term completion and session closure -------------------------------------
ALTER TABLE public.academic_sessions
  ADD COLUMN IF NOT EXISTS first_term_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS second_term_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS third_term_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academic_sessions_term_order_check') THEN
    ALTER TABLE public.academic_sessions ADD CONSTRAINT academic_sessions_term_order_check CHECK (
      (second_term_completed_at IS NULL OR first_term_completed_at IS NOT NULL)
      AND (third_term_completed_at IS NULL OR second_term_completed_at IS NOT NULL)
      AND (closed_at IS NULL OR third_term_completed_at IS NOT NULL)
    );
  END IF;
END $$;

-- 2. Stop promoting on session creation --------------------------------------
DROP TRIGGER IF EXISTS trg_academic_sessions_promote_primary ON public.academic_sessions;

-- 3. Configurable promotion policy -------------------------------------------
--   require_results_all_terms: a pupil needs at least one approved/published
--     result in each of the three terms, otherwise they are flagged for review.
--   min_average: optional. When set, pupils whose average total for the
--     session is below it are flagged for review (not automatically held back).
ALTER TABLE public.college_settings
  ADD COLUMN IF NOT EXISTS promotion_settings jsonb NOT NULL
  DEFAULT '{"require_results_all_terms": true, "min_average": null}'::jsonb;

-- 4. Approved special promotion (e.g. moving a pupil up two classes) ---------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS promotion_override_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promotion_override_note text;

-- 5. Promotion history ---------------------------------------------------------
-- student_class_history already records outcome per session; extend it so
-- each row says which session was completed, the new arm, who did it, any
-- approved exception, and whether it was later reversed.
ALTER TABLE public.student_class_history
  ADD COLUMN IF NOT EXISTS from_session_id uuid REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_class_arm_id uuid REFERENCES public.class_arms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'applied',
  ADD COLUMN IF NOT EXISTS exception_note text,
  ADD COLUMN IF NOT EXISTS performed_by uuid,
  ADD COLUMN IF NOT EXISTS previous_student_status text,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid,
  ADD COLUMN IF NOT EXISTS reversal_reason text;

DO $$
DECLARE con record;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.student_class_history'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%outcome%'
  LOOP
    EXECUTE format('ALTER TABLE public.student_class_history DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.student_class_history
  ADD CONSTRAINT student_class_history_outcome_check
  CHECK (outcome IN ('promoted', 'repeated', 'completed_final_class', 'completed_programme', 'special_promotion'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_class_history_status_check') THEN
    ALTER TABLE public.student_class_history
      ADD CONSTRAINT student_class_history_status_check CHECK (status IN ('applied', 'reversed'));
  END IF;
END $$;

-- One applied outcome per pupil per completed session: the database itself
-- refuses a duplicate promotion.
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_class_history_once_per_session
  ON public.student_class_history (student_id, from_session_id)
  WHERE status = 'applied' AND from_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_class_history_from_session
  ON public.student_class_history (from_session_id);

-- 6. Class progression ---------------------------------------------------------
-- Fill in "next class" links that haven't been set, following the standard
-- sequence Nursery 1 → Nursery 2 → Primary 1 … Primary 6 → JSS 1 … JSS 3 →
-- SS 1 … SS 3, but ONLY between classes that already exist. No class is
-- created, and a link someone already configured is never changed.
CREATE OR REPLACE FUNCTION public.class_progression_key(_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  s text := upper(regexp_replace(coalesce(_name, ''), '[^A-Za-z0-9]', '', 'g'));
  n text := substring(s FROM '([0-9]+)$');
BEGIN
  IF n IS NULL THEN RETURN NULL; END IF;
  IF s ~ '^(NURSERY|NUR)[0-9]+$' THEN RETURN 'N' || n::int; END IF;
  IF s ~ '^(PRIMARY|PRI|PRY)[0-9]+$' THEN RETURN 'P' || n::int; END IF;
  IF s ~ '^(JSS|JS)[0-9]+$' THEN RETURN 'J' || n::int; END IF;
  IF s ~ '^(SSS|SS)[0-9]+$' THEN RETURN 'S' || n::int; END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.class_progression_next_key(_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN _key = 'N1' THEN 'N2'
    WHEN _key = 'N2' THEN 'P1'
    WHEN _key IN ('P1','P2','P3','P4','P5') THEN 'P' || (substring(_key FROM 2)::int + 1)
    WHEN _key = 'P6' THEN 'J1'
    WHEN _key IN ('J1','J2') THEN 'J' || (substring(_key FROM 2)::int + 1)
    WHEN _key = 'J3' THEN 'S1'
    WHEN _key IN ('S1','S2') THEN 'S' || (substring(_key FROM 2)::int + 1)
    ELSE NULL  -- S3 and anything unrecognised: end of programme
  END
$function$;

UPDATE public.departments d
SET next_department_id = nxt.id
FROM public.departments nxt
WHERE d.next_department_id IS NULL
  AND public.class_progression_next_key(public.class_progression_key(d.name)) IS NOT NULL
  AND public.class_progression_key(nxt.name) = public.class_progression_next_key(public.class_progression_key(d.name))
  AND nxt.id <> d.id
  AND (
    SELECT count(*) FROM public.departments x
    WHERE public.class_progression_key(x.name) = public.class_progression_key(nxt.name)
  ) = 1;

-- 7. Who would happen what — the review list --------------------------------
CREATE OR REPLACE FUNCTION public.promotion_candidates(_from_session uuid)
RETURNS TABLE (
  student_id uuid,
  full_name text,
  matric_number text,
  from_department_id uuid,
  from_department_name text,
  from_class_arm_id uuid,
  from_arm_name text,
  from_arm_code text,
  to_department_id uuid,
  to_department_name text,
  to_class_arm_id uuid,
  to_arm_name text,
  to_arm_code text,
  action text,   -- promote | special | repeat | complete | review | done
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  policy jsonb;
  require_all boolean;
  min_avg numeric;
BEGIN
  SELECT coalesce(cs.promotion_settings, '{}'::jsonb) INTO policy FROM public.college_settings cs LIMIT 1;
  require_all := coalesce((policy ->> 'require_results_all_terms')::boolean, true);
  min_avg := nullif(policy ->> 'min_average', '')::numeric;

  RETURN QUERY
  WITH pupils AS (
    SELECT st.id, st.full_name, st.matric_number::text AS matric_number,
           st.department_id, st.class_arm_id, st.repeat_flag,
           st.promotion_override_department_id, st.promotion_override_note,
           d.name AS dept_name, d.next_department_id,
           a.name AS arm_name, a.code AS arm_code
    FROM public.students st
    LEFT JOIN public.departments d ON d.id = st.department_id
    LEFT JOIN public.class_arms a ON a.id = st.class_arm_id
    WHERE st.status = 'active'
       OR EXISTS (SELECT 1 FROM public.student_class_history h
                  WHERE h.student_id = st.id AND h.from_session_id = _from_session AND h.status = 'applied')
  ),
  term_counts AS (
    SELECT r.student_id,
           count(*) FILTER (WHERE r.semester = 'First')  AS first_n,
           count(*) FILTER (WHERE r.semester = 'Second') AS second_n,
           count(*) FILTER (WHERE r.semester = 'Third')  AS third_n,
           avg(coalesce(r.total_score, r.ca_score + r.exam_score)) AS avg_total
    FROM public.results r
    WHERE r.session_id = _from_session AND r.status IN ('approved', 'published')
    GROUP BY r.student_id
  ),
  decided AS (
    SELECT p.*,
           tc.first_n, tc.second_n, tc.third_n, tc.avg_total,
           h.id AS history_id, h.outcome AS done_outcome,
           CASE
             WHEN h.id IS NOT NULL THEN 'done'
             WHEN p.department_id IS NULL THEN 'review'
             WHEN p.promotion_override_department_id IS NOT NULL THEN 'special'
             WHEN p.repeat_flag THEN 'repeat'
             WHEN require_all AND (coalesce(tc.first_n, 0) = 0 OR coalesce(tc.second_n, 0) = 0 OR coalesce(tc.third_n, 0) = 0) THEN 'review'
             WHEN min_avg IS NOT NULL AND (tc.avg_total IS NULL OR tc.avg_total < min_avg) THEN 'review'
             WHEN p.next_department_id IS NULL THEN 'complete'
             ELSE 'promote'
           END AS action,
           CASE
             WHEN h.id IS NOT NULL THEN 'Already processed for this session (' || replace(h.outcome, '_', ' ') || ')'
             WHEN p.department_id IS NULL THEN 'No class on record'
             WHEN p.promotion_override_department_id IS NOT NULL THEN coalesce('Approved special promotion: ' || p.promotion_override_note, 'Approved special promotion')
             WHEN p.repeat_flag THEN 'Approved to repeat this class'
             WHEN require_all AND (coalesce(tc.first_n, 0) = 0 OR coalesce(tc.second_n, 0) = 0 OR coalesce(tc.third_n, 0) = 0) THEN
               'Missing approved results for: ' || concat_ws(', ',
                 CASE WHEN coalesce(tc.first_n, 0) = 0 THEN 'First Term' END,
                 CASE WHEN coalesce(tc.second_n, 0) = 0 THEN 'Second Term' END,
                 CASE WHEN coalesce(tc.third_n, 0) = 0 THEN 'Third Term' END)
             WHEN min_avg IS NOT NULL AND tc.avg_total IS NULL THEN 'No approved results to average'
             WHEN min_avg IS NOT NULL AND tc.avg_total < min_avg THEN
               'Session average ' || round(tc.avg_total, 1) || ' is below the policy minimum of ' || min_avg
             WHEN p.next_department_id IS NULL THEN 'Final class — completes the school programme'
             ELSE NULL
           END AS reason
    FROM pupils p
    LEFT JOIN term_counts tc ON tc.student_id = p.id
    LEFT JOIN public.student_class_history h
      ON h.student_id = p.id AND h.from_session_id = _from_session AND h.status = 'applied'
  )
  SELECT dd.id, dd.full_name, dd.matric_number,
         dd.department_id, dd.dept_name, dd.class_arm_id, dd.arm_name, dd.arm_code,
         tgt.id, tgt.name, tarm.id, tarm.name, tarm.code,
         dd.action, dd.reason
  FROM decided dd
  LEFT JOIN public.departments tgt ON tgt.id = CASE
      WHEN dd.action = 'special' THEN dd.promotion_override_department_id
      WHEN dd.action = 'repeat' THEN dd.department_id
      WHEN dd.action IN ('promote', 'review') THEN dd.next_department_id
      ELSE NULL
    END
  -- New arm: same arm code in the new class ("A" → "A"); if the new class
  -- has only one arm, that one; otherwise left for the exam officer.
  LEFT JOIN LATERAL (
    SELECT ca.id, ca.name, ca.code FROM public.class_arms ca
    WHERE tgt.id IS NOT NULL AND ca.department_id = tgt.id
      AND (
        CASE WHEN dd.action = 'repeat' THEN ca.id = dd.class_arm_id
             ELSE (dd.arm_code IS NOT NULL AND upper(ca.code) = upper(dd.arm_code))
                  OR (SELECT count(*) FROM public.class_arms c2 WHERE c2.department_id = tgt.id) = 1
        END
      )
    ORDER BY (upper(ca.code) = upper(coalesce(dd.arm_code, ''))) DESC
    LIMIT 1
  ) tarm ON true
  ORDER BY dd.dept_name NULLS FIRST, dd.arm_code, dd.full_name;
END;
$function$;

-- 8. Run the promotion ---------------------------------------------------------
-- _decisions: optional {"<student_id>": "promote" | "repeat" | "complete" | "skip"}
-- Pupils listed for review are only processed when the Super Admin has
-- decided for them; everyone else follows their computed action unless a
-- decision overrides it. Returns counts per outcome.
CREATE OR REPLACE FUNCTION public.run_promotion(
  _from_session uuid,
  _to_session uuid,
  _actor uuid,
  _decisions jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  f public.academic_sessions;
  t public.academic_sessions;
  c RECORD;
  act text;
  decision text;
  note text;
  n_promoted int := 0; n_special int := 0; n_repeated int := 0; n_completed int := 0;
  n_skipped int := 0; n_already int := 0; n_no_arm int := 0;
BEGIN
  -- One promotion run per completed session at a time.
  PERFORM pg_advisory_xact_lock(hashtext('promotion:' || _from_session::text));

  SELECT * INTO f FROM public.academic_sessions WHERE id = _from_session;
  IF NOT FOUND THEN RAISE EXCEPTION 'Completed session not found'; END IF;
  SELECT * INTO t FROM public.academic_sessions WHERE id = _to_session;
  IF NOT FOUND THEN RAISE EXCEPTION 'New session not found'; END IF;
  IF f.id = t.id THEN RAISE EXCEPTION 'Choose a different session to promote pupils into'; END IF;

  IF f.first_term_completed_at IS NULL OR f.second_term_completed_at IS NULL OR f.third_term_completed_at IS NULL THEN
    RAISE EXCEPTION 'Session % cannot be used for promotion yet: all three terms must be marked complete', f.name;
  END IF;
  IF f.closed_at IS NULL THEN
    RAISE EXCEPTION 'Session % must be closed before pupils are promoted', f.name;
  END IF;
  IF t.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Session % is already closed and cannot receive promoted pupils', t.name;
  END IF;

  FOR c IN SELECT * FROM public.promotion_candidates(_from_session) LOOP
    IF c.action = 'done' THEN n_already := n_already + 1; CONTINUE; END IF;

    decision := _decisions ->> c.student_id::text;
    act := c.action;
    note := NULL;

    IF decision = 'skip' THEN n_skipped := n_skipped + 1; CONTINUE; END IF;
    IF act = 'review' THEN
      IF decision IS NULL THEN n_skipped := n_skipped + 1; CONTINUE; END IF;
      note := 'Reviewed by administrator: ' || coalesce(c.reason, 'eligibility not established');
    END IF;
    IF decision IN ('promote', 'repeat', 'complete') AND decision <> act THEN
      note := coalesce(note, 'Administrator decision overrode "' || act || '"' || coalesce(' (' || c.reason || ')', ''));
      act := decision;
    END IF;
    IF act = 'review' THEN n_skipped := n_skipped + 1; CONTINUE; END IF;
    IF act = 'promote' AND c.to_department_id IS NULL THEN act := 'complete'; END IF;
    IF c.from_department_id IS NULL AND act <> 'complete' THEN n_skipped := n_skipped + 1; CONTINUE; END IF;

    IF act IN ('promote', 'special') THEN
      INSERT INTO public.student_class_history
        (student_id, session_id, from_session_id, from_department_id, to_department_id,
         from_class_arm_id, to_class_arm_id, outcome, exception_note, performed_by, previous_student_status)
      VALUES
        (c.student_id, _to_session, _from_session, c.from_department_id, c.to_department_id,
         c.from_class_arm_id, c.to_class_arm_id,
         CASE WHEN act = 'special' THEN 'special_promotion' ELSE 'promoted' END,
         CASE WHEN act = 'special' THEN coalesce(note, c.reason) ELSE note END,
         _actor, 'active');

      UPDATE public.students s
      SET department_id = c.to_department_id,
          class_arm_id = c.to_class_arm_id,
          faculty_id = coalesce((SELECT d.faculty_id FROM public.departments d WHERE d.id = c.to_department_id), s.faculty_id),
          repeat_flag = false,
          promotion_override_department_id = NULL,
          promotion_override_note = NULL
      WHERE s.id = c.student_id;

      IF act = 'special' THEN n_special := n_special + 1; ELSE n_promoted := n_promoted + 1; END IF;
      IF c.to_class_arm_id IS NULL THEN n_no_arm := n_no_arm + 1; END IF;

    ELSIF act = 'repeat' THEN
      INSERT INTO public.student_class_history
        (student_id, session_id, from_session_id, from_department_id, to_department_id,
         from_class_arm_id, to_class_arm_id, outcome, exception_note, performed_by, previous_student_status)
      VALUES
        (c.student_id, _to_session, _from_session, c.from_department_id, c.from_department_id,
         c.from_class_arm_id, c.from_class_arm_id, 'repeated', coalesce(note, c.reason), _actor, 'active');

      UPDATE public.students SET repeat_flag = false WHERE id = c.student_id;
      n_repeated := n_repeated + 1;

    ELSIF act = 'complete' THEN
      INSERT INTO public.student_class_history
        (student_id, session_id, from_session_id, from_department_id, to_department_id,
         from_class_arm_id, to_class_arm_id, outcome, exception_note, performed_by, previous_student_status)
      VALUES
        (c.student_id, _to_session, _from_session, c.from_department_id, NULL,
         c.from_class_arm_id, NULL, 'completed_programme', note, _actor, 'active');

      UPDATE public.students
      SET status = 'graduated',
          status_reason = 'Completed the school programme (' || f.name || ')',
          status_date = current_date,
          status_changed_at = now(),
          repeat_flag = false
      WHERE id = c.student_id;
      n_completed := n_completed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'promoted', n_promoted, 'special', n_special, 'repeated', n_repeated,
    'completed', n_completed, 'skipped', n_skipped, 'already', n_already,
    'awaiting_arm', n_no_arm
  );
END;
$function$;

-- 9. Authorised correction -----------------------------------------------------
-- Undo one applied promotion: the pupil goes back to the class and arm they
-- were in, and the history row is kept but marked "reversed" with who did
-- it and why. Refused if the pupil has been moved again since.
CREATE OR REPLACE FUNCTION public.reverse_promotion(_history_id uuid, _actor uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  h public.student_class_history;
  s public.students;
BEGIN
  IF coalesce(length(trim(_reason)), 0) < 5 THEN
    RAISE EXCEPTION 'Give a reason for the correction (at least 5 characters)';
  END IF;

  SELECT * INTO h FROM public.student_class_history WHERE id = _history_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Promotion record not found'; END IF;
  IF h.status <> 'applied' THEN RAISE EXCEPTION 'This promotion has already been reversed'; END IF;
  IF h.from_session_id IS NULL THEN
    RAISE EXCEPTION 'This record predates the promotion system and cannot be reversed automatically';
  END IF;

  SELECT * INTO s FROM public.students WHERE id = h.student_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pupil not found'; END IF;

  IF h.outcome IN ('promoted', 'special_promotion', 'repeated')
     AND s.department_id IS DISTINCT FROM h.to_department_id THEN
    RAISE EXCEPTION '% has moved class since this promotion, so it cannot be undone automatically', s.full_name;
  END IF;
  IF EXISTS (SELECT 1 FROM public.student_class_history x
             WHERE x.student_id = h.student_id AND x.status = 'applied'
               AND x.created_at > h.created_at AND x.id <> h.id) THEN
    RAISE EXCEPTION '% has a later promotion on record; reverse that one first', s.full_name;
  END IF;

  UPDATE public.students st
  SET department_id = coalesce(h.from_department_id, st.department_id),
      class_arm_id = h.from_class_arm_id,
      faculty_id = coalesce((SELECT d.faculty_id FROM public.departments d WHERE d.id = h.from_department_id), st.faculty_id),
      status = CASE WHEN h.outcome = 'completed_programme' THEN coalesce(h.previous_student_status, 'active') ELSE st.status END,
      status_reason = CASE WHEN h.outcome = 'completed_programme' THEN NULL ELSE st.status_reason END,
      status_date = CASE WHEN h.outcome = 'completed_programme' THEN NULL ELSE st.status_date END,
      status_changed_at = CASE WHEN h.outcome = 'completed_programme' THEN now() ELSE st.status_changed_at END,
      repeat_flag = CASE WHEN h.outcome = 'repeated' THEN true ELSE st.repeat_flag END,
      promotion_override_department_id = CASE WHEN h.outcome = 'special_promotion' THEN h.to_department_id ELSE st.promotion_override_department_id END
  WHERE st.id = h.student_id;

  UPDATE public.student_class_history
  SET status = 'reversed', reversed_at = now(), reversed_by = _actor, reversal_reason = trim(_reason)
  WHERE id = _history_id;

  RETURN jsonb_build_object('student_id', h.student_id, 'full_name', s.full_name);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.promotion_candidates(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_promotion(uuid, uuid, uuid, jsonb) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reverse_promotion(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promotion_candidates(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_promotion(uuid, uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_promotion(uuid, uuid, text) TO service_role;
