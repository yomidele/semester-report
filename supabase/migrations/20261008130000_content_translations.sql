-- Hausa versions of text the school types in the admin dashboard (motto,
-- section / programme names and descriptions, staff role titles). The fixed
-- wording of the public site is translated in code; this table covers the
-- editable content. Rows are keyed by the exact English text, so whatever the
-- admin has typed is looked up here when a visitor switches to Hausa, and
-- falls back to the English text when no Hausa version has been entered.
CREATE TABLE IF NOT EXISTS public.content_translations (
  source_text text PRIMARY KEY,
  ha text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read content translations" ON public.content_translations;
CREATE POLICY "Anyone can read content translations" ON public.content_translations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Super admin manages content translations" ON public.content_translations;
CREATE POLICY "Super admin manages content translations" ON public.content_translations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
