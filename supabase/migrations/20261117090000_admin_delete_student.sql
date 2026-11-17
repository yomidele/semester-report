-- Lets the Super Admin permanently delete a pupil who was added by mistake
-- (wrong name, wrong class, duplicate), together with anything already
-- recorded against them.
--
-- Why a function is needed: migration 20260927120000 installed a BEFORE
-- DELETE trigger on public.students that refuses to delete any pupil with
-- results / attendance / report comments / fees / class history. That
-- safety net stays in place for ordinary DELETEs. This function is the one
-- deliberate, audited way past it: it removes the pupil's linked rows first
-- (so the trigger finds no history), then the pupil.
--
-- Safety:
--   * Approved or published results are locked. Unless _allow_locked is
--     true, the function refuses if the pupil has any — use the
--     "withdrawn" status for real pupils who have left.
--   * Everything runs in one transaction: if any step fails, nothing is
--     deleted.
--   * Only the service role (server functions / SQL editor) can call it.

CREATE OR REPLACE FUNCTION public.admin_delete_student(
  _student_id uuid,
  _allow_locked boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name   text;
  v_locked integer := 0;
  v_count  bigint;
  v_summary jsonb := '{}'::jsonb;
  fk RECORD;
BEGIN
  SELECT full_name INTO v_name FROM public.students WHERE id = _student_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pupil not found';
  END IF;

  IF NOT _allow_locked THEN
    SELECT count(*) INTO v_locked
    FROM public.results
    WHERE student_id = _student_id AND status IN ('approved', 'published');
    IF v_locked > 0 THEN
      RAISE EXCEPTION
        '"%" has % approved/published result(s), which are locked. Mark them as withdrawn instead, or return those results for correction first.',
        v_name, v_locked;
    END IF;
  END IF;

  -- Walk every foreign key that points at students(id), so tables added
  -- later are handled automatically.
  --   * nullable link without cascade (e.g. applications.converted_student_id)
  --     -> unlink it, keep the row
  --   * ON DELETE SET NULL -> leave it to Postgres
  --   * anything else (cascade / required link) -> delete the rows
  FOR fk IN
    SELECT c.conrelid::regclass AS tbl,
           a.attname            AS col,
           a.attnotnull         AS not_null,
           c.confdeltype        AS del_action
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.students'::regclass
      AND array_length(c.conkey, 1) = 1
      AND c.conrelid <> 'public.students'::regclass
  LOOP
    IF fk.del_action = 'n' THEN
      CONTINUE;
    ELSIF fk.del_action IN ('a', 'r') AND NOT fk.not_null THEN
      EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = $1', fk.tbl, fk.col, fk.col) USING _student_id;
    ELSE
      EXECUTE format('DELETE FROM %s WHERE %I = $1', fk.tbl, fk.col) USING _student_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      IF v_count > 0 THEN
        v_summary := v_summary || jsonb_build_object(fk.tbl::text, v_count);
      END IF;
    END IF;
  END LOOP;

  DELETE FROM public.students WHERE id = _student_id;

  RETURN jsonb_build_object('full_name', v_name, 'removed', v_summary);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_student(uuid, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_student(uuid, boolean) TO service_role;
