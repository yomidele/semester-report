-- Fixes "Photo upload failed: Bucket not found" on the Staff Profiles
-- ("School Administration") admin page. That page uploads to a storage
-- bucket called "staff-photos", created by
-- 20260913110000_staff_profiles_directory.sql — but if this project's
-- database never had that migration applied (e.g. it was created/deployed
-- before that migration was added, or migrations were run out of order),
-- the bucket simply doesn't exist yet.
--
-- This migration is intentionally standalone and safe to run on its own,
-- even if 20260913110000_staff_profiles_directory.sql already ran here —
-- every statement is idempotent (ON CONFLICT DO NOTHING / IF NOT EXISTS).
--
-- If you're seeing this error right now and don't want to wait for a
-- redeploy: open the Supabase Dashboard -> SQL Editor for this project and
-- run just this file's contents directly. That unblocks photo uploads
-- immediately.

INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-photos', 'staff-photos', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can view staff photos') THEN
    CREATE POLICY "Anyone can view staff photos" ON storage.objects
      FOR SELECT
      USING (bucket_id = 'staff-photos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Super admins upload staff photos') THEN
    CREATE POLICY "Super admins upload staff photos" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'staff-photos' AND public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Super admins update staff photos') THEN
    CREATE POLICY "Super admins update staff photos" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'staff-photos' AND public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Super admins delete staff photos') THEN
    CREATE POLICY "Super admins delete staff photos" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'staff-photos' AND public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;
