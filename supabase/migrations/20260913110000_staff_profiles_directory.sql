-- "School Administration" / staff directory section for the public homepage.
-- Lets the Super Admin list the Head Teacher, Vice Head Teacher, and other
-- staff with a name, role title, and photo, shown on the homepage the way a
-- company site shows its team.

CREATE TABLE IF NOT EXISTS public.staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  role_title text NOT NULL, -- e.g. "Head Teacher (Principal)", "Vice Head Teacher", "Class Teacher, Primary 5"
  category text NOT NULL DEFAULT 'teacher' CHECK (category IN ('head_teacher', 'vice_head_teacher', 'teacher', 'staff')),
  bio text,
  photo_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_published ON public.staff_profiles(is_published, category, display_order);

ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published staff profiles" ON public.staff_profiles
  FOR SELECT
  USING (is_published = true);

CREATE POLICY "Super admins manage staff profiles" ON public.staff_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins view all staff profiles" ON public.staff_profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Public bucket for staff photos, so <img> tags can load them directly
-- without a signed URL. Names/photos of staff who consent to appear on the
-- school website are not sensitive, matching how a school notice board or
-- prospectus already displays this information.
INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-photos', 'staff-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view staff photos" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'staff-photos');

CREATE POLICY "Super admins upload staff photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'staff-photos' AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins update staff photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'staff-photos' AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins delete staff photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'staff-photos' AND public.has_role(auth.uid(), 'super_admin'));
