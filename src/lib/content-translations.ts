import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/i18n";

// Admin-typed public text (motto, school/programme names and descriptions,
// staff role titles) can't live in the code dictionary, so its Hausa versions
// are kept in the `content_translations` table, keyed by the English text.

export function normalizeSource(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function useContentTranslations() {
  return useQuery({
    queryKey: ["content-translations"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("content_translations").select("source_text, ha");
      if (error) return {} as Record<string, string>; // table missing / blocked → just show English
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as { source_text: string; ha: string }[]) map[normalizeSource(row.source_text)] = row.ha;
      return map;
    },
  });
}

/** Returns a function that shows the Hausa version of admin-typed text when the visitor chose Hausa. */
export function useTr() {
  const { lang } = useLanguage();
  const { data: map = {} } = useContentTranslations();
  return (text: string | null | undefined): string => {
    if (!text) return text ?? "";
    if (lang !== "ha") return text;
    return map[normalizeSource(text)] || text;
  };
}
