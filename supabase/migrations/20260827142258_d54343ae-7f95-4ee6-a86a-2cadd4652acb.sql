ALTER TABLE public.faculties ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.faculties ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS description text;

DROP POLICY IF EXISTS "Anyone can view active schools" ON public.faculties;
CREATE POLICY "Anyone can view active schools" ON public.faculties
  FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "Anyone can view active departments" ON public.departments;
CREATE POLICY "Anyone can view active departments" ON public.departments
  FOR SELECT TO anon USING (is_active = true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.faculties FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.departments FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.programmes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.college_settings FROM anon;
GRANT SELECT ON public.faculties, public.departments, public.programmes, public.college_settings TO anon;