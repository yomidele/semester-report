-- Pupil passport photos are stored in the "passports" bucket and shown on
-- student records via a plain public URL (getPublicUrl). The original bucket
-- migration used "ON CONFLICT (id) DO NOTHING", so if a "passports" bucket
-- already existed in the project as a PRIVATE bucket (created by hand in the
-- dashboard, for instance), it was left private — uploads succeeded but every
-- photo URL then returns an error and the record shows "No photo on file".
-- Make sure the bucket is public. Safe to run repeatedly.
UPDATE storage.buckets SET public = true WHERE id = 'passports';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can view passport photos') THEN
    CREATE POLICY "Anyone can view passport photos" ON storage.objects
      FOR SELECT
      USING (bucket_id = 'passports');
  END IF;
END $$;
