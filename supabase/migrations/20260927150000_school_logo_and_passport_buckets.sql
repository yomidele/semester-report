-- Two storage buckets this release now depends on:
--
--   1. "school-logo" — the College Settings page (src/routes/admin.settings.tsx)
--      now uploads the school's logo as an actual image file instead of
--      asking the super admin to paste an image URL. It needs somewhere to
--      put that file.
--
--   2. "passports" — enrollStudent() (src/lib/school-admin.functions.ts) has
--      always tried to upload a pupil's passport photo here, but no
--      migration ever created the bucket, so on a project that only ran the
--      tracked migrations the upload silently failed (caught, logged, and
--      ignored — see the old try/catch this replaces). The photo is now a
--      REQUIRED part of enrolling a single pupil (upload a file or capture
--      one from the camera on the Enrol a Pupil page), and a failed upload
--      now fails the whole enrolment loudly instead of quietly leaving the
--      pupil with no photo — so the bucket has to actually exist.
--
-- Both follow the same idempotent, standalone pattern already established
-- by 20260925120000_fix_staff_photos_bucket.sql: safe to run even if part of
-- it already exists, and safe to run directly from the Supabase SQL Editor
-- without waiting for a full redeploy.

-- ---------------------------------------------------------------------------
-- 1) school-logo
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-logo', 'school-logo', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can view the school logo') THEN
    CREATE POLICY "Anyone can view the school logo" ON storage.objects
      FOR SELECT
      USING (bucket_id = 'school-logo');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Super admins upload the school logo') THEN
    CREATE POLICY "Super admins upload the school logo" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'school-logo' AND public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Super admins update the school logo') THEN
    CREATE POLICY "Super admins update the school logo" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'school-logo' AND public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Super admins delete the school logo') THEN
    CREATE POLICY "Super admins delete the school logo" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'school-logo' AND public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) passports
--
-- enrollStudent() currently uploads via the service-role client
-- (supabaseAdmin), which bypasses RLS entirely — so strictly speaking only
-- the bucket's existence (the INSERT into storage.buckets below) is
-- required for that path to work. The INSERT/UPDATE/DELETE policies below
-- are added anyway, scoped to admission_officer and super_admin, so any
-- future direct-from-browser upload (e.g. "replace this pupil's photo"
-- from Student Records) has a correct policy already in place rather than
-- silently relying on RLS being bypassed.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('passports', 'passports', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can view passport photos') THEN
    CREATE POLICY "Anyone can view passport photos" ON storage.objects
      FOR SELECT
      USING (bucket_id = 'passports');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admission staff upload passport photos') THEN
    CREATE POLICY "Admission staff upload passport photos" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'passports'
        AND (public.has_role(auth.uid(), 'admission_officer') OR public.has_role(auth.uid(), 'super_admin'))
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admission staff update passport photos') THEN
    CREATE POLICY "Admission staff update passport photos" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'passports'
        AND (public.has_role(auth.uid(), 'admission_officer') OR public.has_role(auth.uid(), 'super_admin'))
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admission staff delete passport photos') THEN
    CREATE POLICY "Admission staff delete passport photos" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'passports'
        AND (public.has_role(auth.uid(), 'admission_officer') OR public.has_role(auth.uid(), 'super_admin'))
      );
  END IF;
END $$;
