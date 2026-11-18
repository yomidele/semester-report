import { createFileRoute } from "@tanstack/react-router";
import { ProtectedExamOfficer } from "@/components/ProtectedExamOfficer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { listSessionProgress, updateSessionProgress, type SessionProgress } from "@/lib/promotion.functions";
import { useRole } from "@/hooks/use-role";

const STEPS = [
  { key: "first", label: "First Term", field: "first_term_completed_at" },
  { key: "second", label: "Second Term", field: "second_term_completed_at" },
  { key: "third", label: "Third Term", field: "third_term_completed_at" },
  { key: "close", label: "Closed", field: "closed_at" },
] as const;

export const Route = createFileRoute("/sessions")({
  head: () => ({ meta: [{ title: "Academic Sessions — School Portal" }] }),
  component: () => <ProtectedExamOfficer><SessionsPage /></ProtectedExamOfficer>,
});

function SessionsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { isSuperAdmin } = useRole();
  const listProgress = useServerFn(listSessionProgress);
  const setProgress = useServerFn(updateSessionProgress);

  // Sessions with their term-completion progress. Falls back to the plain
  // list if the term-completion columns haven't been added to the database yet.
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["session-progress"],
    queryFn: async (): Promise<SessionProgress[]> => {
      try {
        return await listProgress();
      } catch {
        const { data, error } = await supabase.from("academic_sessions").select("*").order("name", { ascending: false });
        if (error) throw error;
        return (data ?? []).map((x: any) => ({ first_term_completed_at: null, second_term_completed_at: null, third_term_completed_at: null, closed_at: null, ...x }));
      }
    },
  });

  const stepMut = useMutation({
    mutationFn: (v: { session_id: string; step: (typeof STEPS)[number]["key"]; done: boolean }) => setProgress({ data: v }),
    onSuccess: () => { toast.success("Session updated"); qc.invalidateQueries({ queryKey: ["session-progress"] }); qc.invalidateQueries({ queryKey: ["promotion-overview"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMut = useMutation({
    mutationFn: async (n: string) => {
      // Creating a session no longer promotes anyone. Promotion is run by
      // the Super Admin from Student Promotion, after the previous session's
      // three terms are complete and it has been closed.
      const { error } = await supabase.from("academic_sessions").insert({ name: n });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Session created. Pupils are promoted into it from Student Promotion once the previous session is closed.");
      setName("");
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["session-progress"] });
      qc.invalidateQueries({ queryKey: ["count","academic_sessions"]});
      qc.invalidateQueries({ queryKey: ["roster"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academic_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Session removed"); qc.invalidateQueries({ queryKey: ["sessions"] }); qc.invalidateQueries({ queryKey: ["session-progress"] }); qc.invalidateQueries({ queryKey: ["count","academic_sessions"]}); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Academic Sessions</h2>
        <p className="text-sm text-muted-foreground">
          Define academic sessions and mark each term complete as the year goes on. Once the Third Term is complete and
          the session is closed, pupils can be promoted{isSuperAdmin ? <> from <Link to="/admin/promotions" className="font-medium underline">Student Promotion</Link></> : " by the Super Admin"}.
        </p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="text-base">Add a session</CardTitle>
          <CardDescription>Format: <code>YYYY/YYYY</code> (e.g. 2024/2025).</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; addMut.mutate(name.trim()); }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="sname">Session name</Label>
              <Input id="sname" placeholder="2024/2025" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <Button type="submit" disabled={addMut.isPending}>{addMut.isPending ? "Saving…" : "Add session"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">Sessions and term progress</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>}
          {!isLoading && sessions.length === 0 && <p className="text-sm text-muted-foreground">No sessions yet.</p>}
          {sessions.map((s) => {
            const doneCount = STEPS.filter((st) => !!s[st.field]).length;
            const next = STEPS[doneCount];
            const last = doneCount > 0 ? STEPS[doneCount - 1] : undefined;
            return (
              <div key={s.id} className="rounded-md border border-border p-3 md:p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold">{s.name}</p>
                    <ol className="mt-2 flex flex-wrap gap-1.5">
                      {STEPS.map((st) => (
                        <li key={st.key} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${s[st.field] ? "border-success/40 bg-success/10" : "border-border text-muted-foreground"}`}>
                          {s[st.field] ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Circle className="h-3.5 w-3.5" />}
                          {st.label}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {next && (
                      <Button size="sm" className="h-9" disabled={stepMut.isPending}
                        onClick={() => { if (confirm(next.key === "close" ? `Close ${s.name}?` : `Mark the ${next.label} of ${s.name} complete?`)) stepMut.mutate({ session_id: s.id, step: next.key, done: true }); }}>
                        {next.key === "close" ? "Close session" : `Complete ${next.label}`}
                      </Button>
                    )}
                    {last && (
                      <Button size="sm" variant="outline" className="h-9" disabled={stepMut.isPending}
                        onClick={() => { if (confirm(`Undo "${last.label}" for ${s.name}?`)) stepMut.mutate({ session_id: s.id, step: last.key, done: false }); }}>
                        Undo {last.key === "close" ? "close" : last.label}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-9" aria-label={`Delete ${s.name}`}
                      onClick={() => { if (confirm(`Delete session ${s.name}? Related results will be removed.`)) delMut.mutate(s.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
