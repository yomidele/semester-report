import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { useRole } from "@/hooks/use-role";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useCollegeSettings } from "@/lib/college-settings";
import { useSchools, useProgrammes } from "@/lib/public-catalog";
import { normalizeSource, useContentTranslations } from "@/lib/content-translations";

export const Route = createFileRoute("/admin/translations")({
  head: () => ({ meta: [{ title: "Hausa Translations — Super Admin" }] }),
  component: () => (
    <ProtectedAdmin>
      <Page />
    </ProtectedAdmin>
  ),
});

function Page() {
  const { isSuperAdmin, loading } = useRole();
  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin text-primary" />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;
  return <TranslationsPage />;
}

type Item = { text: string; where: string };

function TranslationsPage() {
  const qc = useQueryClient();
  const { settings } = useCollegeSettings();
  const { data: schools = [] } = useSchools();
  const { data: programmes = [] } = useProgrammes();
  const { data: saved = {} } = useContentTranslations();
  const staff = useQuery({
    queryKey: ["translations-staff-titles"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("role_title").eq("is_published", true);
      return (data ?? []) as { role_title: string | null }[];
    },
  });

  // Every piece of admin-typed text the public site shows, de-duplicated.
  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: Item[] = [];
    const add = (text: string | null | undefined, where: string) => {
      if (!text) return;
      const key = normalizeSource(text);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ text: key, where });
    };
    add(settings.motto, "School motto");
    schools.forEach((s) => { add(s.name, "School section name"); add(s.description, "School section description"); });
    programmes.forEach((p) => { add(p.name, "Programme name"); add(p.description, "Programme description"); });
    (staff.data ?? []).forEach((m) => add(m.role_title, "Staff role title"));
    return out;
  }, [settings.motto, schools, programmes, staff.data]);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => { setDrafts({}); }, [saved]);

  const valueFor = (text: string) => drafts[text] ?? saved[text] ?? "";
  const changed = items.filter((i) => (drafts[i.text] ?? saved[i.text] ?? "") !== (saved[i.text] ?? ""));

  const save = useMutation({
    mutationFn: async () => {
      const toSave = changed.filter((i) => valueFor(i.text).trim());
      const toClear = changed.filter((i) => !valueFor(i.text).trim() && saved[i.text]);
      if (toSave.length) {
        const { error } = await (supabase as any)
          .from("content_translations")
          .upsert(toSave.map((i) => ({ source_text: i.text, ha: valueFor(i.text).trim(), updated_at: new Date().toISOString() })), { onConflict: "source_text" });
        if (error) throw error;
      }
      for (const i of toClear) {
        const { error } = await (supabase as any).from("content_translations").delete().eq("source_text", i.text);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Hausa translations saved"); qc.invalidateQueries({ queryKey: ["content-translations"] }); },
    onError: (e: Error) => toast.error(`Couldn't save: ${e.message}`),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Hausa Translations</h2>
        <p className="text-sm text-muted-foreground">
          The fixed wording of the public website is already in Hausa. Text you type yourself — the motto, school section and programme names and descriptions,
          staff role titles — is listed here so you can add its Hausa version. Visitors who switch to Hausa see these; anything left blank stays in English.
        </p>
      </div>
      <Card className="tsu-shadow">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{items.length} text{items.length !== 1 ? "s" : ""} to translate</CardTitle>
          <Button size="sm" onClick={() => save.mutate()} disabled={changed.length === 0 || save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save{changed.length ? ` (${changed.length})` : ""}
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing to translate yet.</p>}
          {items.map((i) => (
            <div key={i.text} className="grid gap-2 border-b pb-4 last:border-0 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{i.where}</p>
                <p className="mt-1 text-sm">{i.text}</p>
              </div>
              <Textarea
                rows={i.text.length > 80 ? 3 : 1}
                placeholder="Hausa version"
                value={valueFor(i.text)}
                onChange={(e) => setDrafts((d) => ({ ...d, [i.text]: e.target.value }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
