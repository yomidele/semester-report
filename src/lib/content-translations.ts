import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/i18n";

// Admin-typed public text (motto, school/programme names and descriptions,
// staff role titles) can't live in the code dictionary, so its Hausa versions
// are kept in the `content_translations` table, keyed by the English text.

export function normalizeSource(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

const MAX_CHUNK = 900;

/**
 * Long text (news articles) is translated a paragraph at a time — and any
 * paragraph over ~900 characters sentence by sentence — so each piece stays a
 * comfortable size to translate and to store. The same split is used by the
 * admin Translations page, so what it lists is exactly what the site looks up.
 */
export function chunksOf(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const para of text.split(/\n{2,}/)) {
    const norm = normalizeSource(para);
    if (!norm) continue;
    if (norm.length <= MAX_CHUNK) { out.push(norm); continue; }
    let cur = "";
    for (const sentence of norm.split(/(?<=[.!?])\s+/)) {
      if (cur && (cur + " " + sentence).length > MAX_CHUNK) { out.push(cur); cur = sentence; }
      else cur = cur ? cur + " " + sentence : sentence;
    }
    if (cur) out.push(cur);
  }
  return out;
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

/** Like useTr, but for multi-paragraph text: keeps paragraph breaks and translates piece by piece. */
export function useTrRich() {
  const { lang } = useLanguage();
  const { data: map = {} } = useContentTranslations();
  return (text: string | null | undefined): string => {
    if (!text) return text ?? "";
    if (lang !== "ha") return text;
    return text
      .split(/(\n{2,})/)
      .map((para) => {
        if (/^\n{2,}$/.test(para) || !para.trim()) return para;
        const chunks = chunksOf(para);
        if (!chunks.some((c) => map[c])) return para;
        return chunks.map((c) => map[c] || c).join(" ");
      })
      .join("");
  };
}
