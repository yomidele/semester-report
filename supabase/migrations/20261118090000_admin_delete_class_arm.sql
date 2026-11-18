-- Delete a class arm (e.g. "Primary 5A") safely.
--
-- A plain DELETE on class_arms would:
--   * leave its pupils with no arm (students.class_arm_id → NULL),
--   * turn every teacher subject assignment for that arm into an
--     "all arms" assignment (course_assignments.class_arm_id → NULL means
--     the whole class), silently giving a 5A teacher every Primary 5 pupil,
--   * drop the arm from old attendance records.
--
-- This function instead:
--   1. moves the arm's pupils (any status) and attendance records into
--      another arm of the SAME class you choose,
--   2. removes the teacher subject assignments that were for this arm only
--      (results are not linked to arms and are untouched),
--   3. deletes the arm (its subject list goes with it).
-- If the arm still has pupils and no destination arm is given, it refuses.
-- Everything happens in one transaction.

CREATE OR REPLACE FUNCTION public.admin_delete_class_arm(
  _arm_id uuid,
  _move_to_arm_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_arm   public.class_arms;
  v_dest  public.class_arms;
  v_class text;
  v_pupils int := 0;
  v_moved int := 0;
  v_att int := 0;
  v_assign int := 0;
BEGIN
  SELECT * INTO v_arm FROM public.class_arms WHERE id = _arm_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Class arm not found'; END IF;
  SELECT name INTO v_class FROM public.departments WHERE id = v_arm.department_id;

  SELECT count(*) INTO v_pupils FROM public.students WHERE class_arm_id = _arm_id;

  IF _move_to_arm_id IS NOT NULL THEN
    IF _move_to_arm_id = _arm_id THEN RAISE EXCEPTION 'Choose a different arm to move pupils into'; END IF;
    SELECT * INTO v_dest FROM public.class_arms WHERE id = _move_to_arm_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Destination arm not found'; END IF;
    IF v_dest.department_id <> v_arm.department_id THEN
      RAISE EXCEPTION 'Pupils can only be moved to another arm of %', coalesce(v_class, 'the same class');
    END IF;
  ELSIF v_pupils > 0 THEN
    RAISE EXCEPTION '% has % pupil(s). Choose another arm of % to move them into first.',
      v_arm.name, v_pupils, coalesce(v_class, 'the same class');
  END IF;

  IF _move_to_arm_id IS NOT NULL THEN
    UPDATE public.students SET class_arm_id = _move_to_arm_id WHERE class_arm_id = _arm_id;
    GET DIAGNOSTICS v_moved = ROW_COUNT;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'class_arm_id') THEN
      EXECUTE 'UPDATE public.attendance SET class_arm_id = $1 WHERE class_arm_id = $2' USING _move_to_arm_id, _arm_id;
      GET DIAGNOSTICS v_att = ROW_COUNT;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'course_assignments' AND column_name = 'class_arm_id') THEN
    EXECUTE 'DELETE FROM public.course_assignments WHERE class_arm_id = $1' USING _arm_id;
    GET DIAGNOSTICS v_assign = ROW_COUNT;
  END IF;

  DELETE FROM public.class_arms WHERE id = _arm_id;

  RETURN jsonb_build_object(
    'arm', v_arm.name, 'class', v_class,
    'pupils_moved', v_moved, 'attendance_moved', v_att,
    'teacher_assignments_removed', v_assign,
    'moved_to', v_dest.name
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_class_arm(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_class_arm(uuid, uuid) TO service_role;
