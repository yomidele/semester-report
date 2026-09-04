REVOKE EXECUTE ON FUNCTION public.promote_students_to_session(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.next_matric_seq(uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_carryover_on_result() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_promote_on_session_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_faculty_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_faculty_id() TO authenticated;