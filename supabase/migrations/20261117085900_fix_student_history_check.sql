-- Fixes: relation "public.student_fees" does not exist
-- The "don't delete pupils with history" check named a table your database
-- doesn't have. This version only checks tables that actually exist.
CREATE OR REPLACE FUNCTION public.prevent_delete_students_with_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t text;
  found_history boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['results', 'attendance', 'report_card_comments', 'student_class_history', 'student_fees']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE student_id = $1)', t)
        INTO found_history USING OLD.id;
      IF found_history THEN
        RAISE EXCEPTION
          'Cannot permanently delete "%": they have academic history (results, attendance, fees, or class history) on record. Set their status to withdrawn, transferred, or graduated instead.',
          OLD.full_name
          USING ERRCODE = 'foreign_key_violation';
      END IF;
    END IF;
  END LOOP;
  RETURN OLD;
END;
$function$;
