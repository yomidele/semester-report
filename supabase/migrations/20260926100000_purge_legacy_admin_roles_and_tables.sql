-- Finish the Section Admin / Class Admin removal at the database level.
--
-- 20260925140000_consolidate_school_roles_and_form_masters.sql already made
-- the retired roles unusable (deleted their grants, and added a trigger that
-- rejects any row using a role outside the four active ones). This migration
-- goes one step further and physically removes what's left: the two
-- standalone legacy tables, and the unused enum labels themselves.
--
-- IMPORTANT: run this on a staging copy of the database first. It captures
-- and rebuilds every RLS policy and function that depends on the app_role
-- type generically (via the system catalogs), rather than hand-listing them,
-- because this project's earliest schema (tables/functions/policies created
-- before this migrations folder started) isn't visible from the repo. The
-- generic capture/rebuild is intentional and should reproduce every existing
-- policy byte-for-byte, but please diff `pg_policies` before/after in
-- staging before applying this to production.

-- ---------------------------------------------------------------------------
-- 1) Drop the orphaned Section Admin / Class Admin tables.
-- No other table has a foreign key pointing at either one (confirmed via the
-- generated types: both show `Relationships: []`), so this is an isolated
-- drop. CASCADE here only removes each table's own indexes/policies/grants,
-- not anything belonging to a different table.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.department_admins CASCADE;
DROP TABLE IF EXISTS public.faculty_admins CASCADE;

-- ---------------------------------------------------------------------------
-- 2) Shrink app_role down to the four active portal roles.
--
-- Postgres has no "ALTER TYPE ... DROP VALUE", so the only way to actually
-- remove a value is to swap in a new, smaller enum. Anything that depends on
-- the old type (has_role(), and any RLS policy built on it) has to be pulled
-- down and rebuilt around the swap. Rather than hand-list those objects —
-- which risks missing one defined outside this migrations folder — this
-- captures them generically from the system catalogs.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn record;
  pol record;
BEGIN
  -- Belt-and-braces: the previous migration's trigger already blocks any row
  -- outside the four active roles; this just guarantees the cast below can't
  -- fail if something slipped through some other write path.
  DELETE FROM public.user_roles
  WHERE role::text NOT IN ('super_admin', 'teacher', 'exam_officer', 'admission_officer');

  -- Capture every policy that calls has_role(...) (or otherwise mentions
  -- app_role), then drop it. We rebuild each one verbatim after the type
  -- swap, so this is a no-op from the application's point of view.
  CREATE TEMP TABLE _saved_policies AS
  SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual ILIKE '%has_role%' OR with_check ILIKE '%has_role%'
         OR qual ILIKE '%app_role%' OR with_check ILIKE '%app_role%');

  FOR pol IN SELECT * FROM _saved_policies LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;

  -- Capture every function whose signature mentions app_role (this project's
  -- has_role(uuid, app_role), and anything else that might reference it),
  -- keyed by oid so we can drop it precisely with ::regprocedure.
  CREATE TEMP TABLE _saved_functions AS
  SELECT p.oid, pg_get_functiondef(p.oid) AS def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND pg_get_function_identity_arguments(p.oid) ILIKE '%app_role%';

  FOR fn IN SELECT oid FROM _saved_functions LOOP
    EXECUTE format('DROP FUNCTION %s', fn.oid::regprocedure);
  END LOOP;

  -- Build the smaller type, point user_roles.role at it, then retire the old
  -- type. Renaming the new type back to "app_role" means every captured
  -- function/policy definition below can be replayed unchanged — they refer
  -- to the type by name, and the name now points at the new, smaller set.
  CREATE TYPE public.app_role_v2 AS ENUM ('super_admin', 'teacher', 'exam_officer', 'admission_officer');

  ALTER TABLE public.user_roles
    ALTER COLUMN role TYPE public.app_role_v2 USING role::text::public.app_role_v2;

  DROP TYPE public.app_role;
  ALTER TYPE public.app_role_v2 RENAME TO app_role;

  -- Replay the captured functions, then the captured policies, in that
  -- order (policies call the functions, so the functions must exist first).
  FOR fn IN SELECT def FROM _saved_functions LOOP
    EXECUTE fn.def;
  END LOOP;

  FOR pol IN SELECT * FROM _saved_policies LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s USING (%s)%s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      CASE WHEN pol.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      pol.cmd,
      array_to_string(pol.roles, ', '),
      pol.qual,
      CASE WHEN pol.with_check IS NOT NULL THEN format(' WITH CHECK (%s)', pol.with_check) ELSE '' END
    );
  END LOOP;

  -- Function grants (e.g. "GRANT EXECUTE ... TO authenticated") are not
  -- captured above (pg_get_functiondef doesn't include them) and were
  -- dropped along with the old function objects. Re-apply the one grant
  -- this project's migrations set explicitly, matching
  -- 20260827142034_...sql. If other functions had their own custom grants,
  -- reapply those manually after reviewing `\df+` in staging.
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated';
  END IF;
END $$;
