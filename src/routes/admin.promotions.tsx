import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Circle, History, Loader2, RotateCcw, Search, TrendingUp, Users,
} from "lucide-react";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { resultsClassLabel } from "@/lib/class-display";
import {
  getPromotionOverview, reversePromotion, runPromotion, savePromotionPolicy, setSpecialPromotion, updateSessionProgress,
  type PromotionAction, type PromotionCandidate, type SessionProgress,
} from "@/lib/promotion.functions";

export const Route = createFileRoute("/admin/promotions")({
  head: () => ({ meta: [{ title: "Student Promotion — School Portal" }] }),
  component: () => <ProtectedAdmin><PromotionPage /></ProtectedAdmin>,
});

type Decision = "auto" | "promote" | "repeat" | "complete" | "skip";

const ACTION_STYLE: Record<PromotionAction, { label: string; className: string }> = {
  promote: { label: "Promote", className: "border-success/30 bg-success/15 text-success" },
  special: { label: "Special promotion", className: "border-primary-dark/30 bg-secondary text-foreground" },
  repeat: { label: "Repeat class", className: "border-warning/40 bg-warning/15 text-foreground" },
  complete: { label: "Completes programme", className: "border-primary-dark/30 bg-accent text-foreground" },
  review: { label: "Needs review", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  done: { label: "Already processed", className: "border-border bg-muted text-muted-foreground" },
};

const OUTCOME_LABEL: Record<string, string> = {
  promoted: "Promoted",
  special_promotion: "Special promotion",
  repeated: "Repeated",
  completed_programme: "Completed programme",
  completed_final_class: "Completed final class",
};

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}

const STEPS = [
  { key: "first", label: "First Term", field: "first_term_completed_at" },
  { key: "second", label: "Second Term", field: "second_term_completed_at" },
  { key: "third", label: "Third Term", field: "third_term_completed_at" },
  { key: "close", label: "Session closed", field: "closed_at" },
] as const;

function readiness(s: SessionProgress | undefined) {
  if (!s) return { done: 0, ready: false };
  const done = STEPS.filter((st) => !!s[st.field]).length;
  return { done, ready: done === 4 };
}

function fmtDate(v: string | null | undefined) {
  return v ? new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
}

function effectiveAction(c: PromotionCandidate, d: Decision | undefined): PromotionAction | "skip" {
  if (c.action === "done") return "done";
  if (!d || d === "auto") return c.action === "review" ? "skip" : c.action;
  if (d === "promote" && !c.to_department_id) return "complete";
  return d;
}

function PromotionPage() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const fetchOverview = useServerFn(getPromotionOverview);
  const doRun = useServerFn(runPromotion);
  const doReverse = useServerFn(reversePromotion);
  const doPolicy = useServerFn(savePromotionPolicy);
  const doStep = useServerFn(updateSessionProgress);
  const doSpecial = useServerFn(setSpecialPromotion);

  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState("");
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [filter, setFilter] = useState<"all" | PromotionAction>("all");
  const [search, setSearch] = useState("");
  const [confirmRun, setConfirmRun] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<{ id: string; name: string } | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [specialTarget, setSpecialTarget] = useState<PromotionCandidate | null>(null);
  const [specialDept, setSpecialDept] = useState("");
  const [specialNote, setSpecialNote] = useState("");
  const [policyDraft, setPolicyDraft] = useState<{ require: boolean; min: string } | null>(null);

  const overview = useQuery({
    queryKey: ["promotion-overview", fromId],
    queryFn: () => fetchOverview({ data: { from_session_id: fromId } }),
  });
  const sessions = overview.data?.sessions ?? [];
  const candidates = overview.data?.candidates ?? [];
  const history = overview.data?.history ?? [];
  const departments = overview.data?.departments ?? [];

  // Default selection: the most recent closed session as "completed", and
  // the session right after it as "promote into".
  useEffect(() => {
    if (fromId || sessions.length === 0) return;
    const closed = sessions.find((s) => s.closed_at) ?? sessions[sessions.length > 1 ? 1 : 0];
    setFromId(closed.id);
  }, [sessions, fromId]);
  useEffect(() => {
    if (!fromId || toId || sessions.length === 0) return;
    const idx = sessions.findIndex((s) => s.id === fromId);
    const newer = idx > 0 ? sessions[idx - 1] : undefined;
    if (newer && !newer.closed_at) setToId(newer.id);
  }, [fromId, sessions, toId]);
  useEffect(() => {
    if (overview.data && !policyDraft) {
      setPolicyDraft({
        require: overview.data.policy.require_results_all_terms,
        min: overview.data.policy.min_average == null ? "" : String(overview.data.policy.min_average),
      });
    }
  }, [overview.data, policyDraft]);

  const fromSession = sessions.find((s) => s.id === fromId);
  const toSession = sessions.find((s) => s.id === toId);
  const { done: stepsDone, ready } = readiness(fromSession);
  const currentSession = sessions.find((s) => !s.closed_at);

  const counts = useMemo(() => {
    const c = { promote: 0, special: 0, repeat: 0, complete: 0, review: 0, done: 0 } as Record<PromotionAction, number>;
    candidates.forEach((x) => { c[x.action] += 1; });
    return c;
  }, [candidates]);

  const plan = useMemo(() => {
    const p = { promote: 0, special: 0, repeat: 0, complete: 0, skip: 0, done: 0 } as Record<string, number>;
    candidates.forEach((x) => { p[effectiveAction(x, decisions[x.student_id])] += 1; });
    return p;
  }, [candidates, decisions]);

  const applied = history.filter((h) => h.status === "applied");
  const promotedCount = applied.filter((h) => h.outcome === "promoted" || h.outcome === "special_promotion").length;
  const awaitingArm = applied.filter((h) => (h.outcome === "promoted" || h.outcome === "special_promotion") && !h.to_arm).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (filter !== "all" && c.action !== filter) return false;
      if (!q) return true;
      return c.full_name.toLowerCase().includes(q) || (c.matric_number ?? "").toLowerCase().includes(q);
    });
  }, [candidates, filter, search]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["promotion-overview"] });

  const stepMut = useMutation({
    mutationFn: (v: { step: (typeof STEPS)[number]["key"]; done: boolean }) =>
      doStep({ data: { session_id: fromId!, step: v.step, done: v.done } }),
    onSuccess: () => { toast.success("Session updated"); refresh(); qc.invalidateQueries({ queryKey: ["session-progress"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const policyMut = useMutation({
    mutationFn: () => {
      const min = policyDraft!.min.trim() === "" ? null : Number(policyDraft!.min);
      if (min !== null && (Number.isNaN(min) || min < 0 || min > 100)) throw new Error("Minimum average must be between 0 and 100, or left blank");
      return doPolicy({ data: { require_results_all_terms: policyDraft!.require, min_average: min } });
    },
    onSuccess: () => { toast.success("Promotion policy saved"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const runMut = useMutation({
    mutationFn: () => {
      const payload: Record<string, "promote" | "repeat" | "complete" | "skip"> = {};
      Object.entries(decisions).forEach(([id, d]) => { if (d !== "auto") payload[id] = d; });
      return doRun({ data: { from_session_id: fromId!, to_session_id: toId, decisions: payload } });
    },
    onSuccess: (s) => {
      toast.success(
        `Done: ${s.promoted} promoted` +
          (s.special ? `, ${s.special} special` : "") +
          (s.repeated ? `, ${s.repeated} repeating` : "") +
          (s.completed ? `, ${s.completed} completed the programme` : "") +
          (s.skipped ? `, ${s.skipped} left for review` : ""),
      );
      if (s.awaiting_arm) toast.info(`${s.awaiting_arm} promoted pupil(s) still need an arm in their new class (Classes & Arms).`);
      setDecisions({});
      setConfirmRun(false);
      refresh();
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => { toast.error(e.message); setConfirmRun(false); },
  });

  const reverseMut = useMutation({
    mutationFn: () => doReverse({ data: { history_id: reverseTarget!.id, reason: reverseReason } }),
    onSuccess: (r) => { toast.success(`${r.full_name} was moved back to their previous class`); setReverseTarget(null); setReverseReason(""); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const specialMut = useMutation({
    mutationFn: (clear: boolean) =>
      doSpecial({ data: { student_id: specialTarget!.student_id, department_id: clear ? null : specialDept || null, note: clear ? undefined : specialNote } }),
    onSuccess: () => { toast.success("Saved"); setSpecialTarget(null); setSpecialDept(""); setSpecialNote(""); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fromClass = (c: PromotionCandidate) =>
    c.from_department_name ? resultsClassLabel(c.from_department_name, c.from_class_arm_id ? { name: c.from_arm_name, code: c.from_arm_code } : null) : "No class";
  const toClass = (c: PromotionCandidate) => {
    const act = effectiveAction(c, decisions[c.student_id]);
    if (act === "complete") return "Completes programme";
    if (act === "skip") return "No change";
    if (act === "done") return "—";
    if (act === "repeat") return fromClass(c);
    if (!c.to_department_name) return "—";
    return c.to_class_arm_id
      ? resultsClassLabel(c.to_department_name, { name: c.to_arm_name, code: c.to_arm_code })
      : `${c.to_department_name} (arm to assign)`;
  };

  const decisionSelect = (c: PromotionCandidate) => {
    if (c.action === "done") return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <Select
        value={decisions[c.student_id] ?? "auto"}
        onValueChange={(v) => {
          if (v === "special") { setSpecialTarget(c); setSpecialDept(c.action === "special" ? c.to_department_id ?? "" : ""); return; }
          setDecisions((p) => ({ ...p, [c.student_id]: v as Decision }));
        }}
      >
        <SelectTrigger className="h-10 w-full md:w-48" aria-label={`Decision for ${c.full_name}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">{c.action === "review" ? "Leave for later" : "Follow the plan"}</SelectItem>
          {c.to_department_id && <SelectItem value="promote">Promote</SelectItem>}
          <SelectItem value="repeat">Repeat class</SelectItem>
          <SelectItem value="complete">Completes programme</SelectItem>
          <SelectItem value="skip">Skip this time</SelectItem>
          <SelectItem value="special">{c.action === "special" ? "Change special promotion…" : "Special promotion…"}</SelectItem>
        </SelectContent>
      </Select>
    );
  };

  const stat = (label: string, value: React.ReactNode, hint?: string, Icon?: typeof Users) => (
    <Card className="tsu-shadow">
      <CardContent className="flex items-start gap-3 p-4">
        {Icon && <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground"><Icon className="h-4 w-4" /></span>}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="break-words text-xl font-bold leading-tight">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );

  if (overview.isLoading) {
    return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading promotion data…</div>;
  }
  if (overview.error) {
    return <Card><CardContent className="p-6 text-sm text-destructive">{(overview.error as Error).message}</CardContent></Card>;
  }

  const nextStep = STEPS[stepsDone];
  const lastStep = stepsDone > 0 ? STEPS[stepsDone - 1] : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Student Promotion</h2>
        <p className="text-sm text-muted-foreground">
          Pupils move to their next class once all three terms of a session are complete and the session is closed.
          Review the list, decide for anyone flagged, then run the promotion. Results, report cards, attendance and
          admission numbers are never changed or deleted.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stat("Current session", currentSession?.name ?? "—", undefined, TrendingUp)}
        {stat("Promoting into", toSession?.name ?? "Not chosen", toSession ? undefined : "Create the new session under Sessions & Terms", ArrowRight)}
        {stat("Pupils enrolled", overview.data?.activeCount ?? 0, "Active on the roster", Users)}
        {stat("Eligible for promotion", counts.promote + counts.special, `${counts.complete} completing the programme`, CheckCircle2)}
        {stat("Awaiting promotion", candidates.length - counts.done, fromSession ? `From ${fromSession.name}` : undefined, Circle)}
        {stat("Promoted", promotedCount, `${applied.filter((h) => h.outcome === "repeated").length} repeating · ${applied.filter((h) => h.outcome === "completed_programme").length} completed`, CheckCircle2)}
        {stat("Need attention", counts.review + awaitingArm, `${counts.review} to review · ${awaitingArm} need a new arm`, AlertTriangle)}
        {stat("History records", history.length, "For this session", History)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="tsu-shadow">
          <CardHeader>
            <CardTitle className="text-base">1. Choose the sessions</CardTitle>
            <CardDescription>Promote pupils out of a completed session into the new one.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Completed session</Label>
                <Select value={fromId ?? ""} onValueChange={(v) => { setFromId(v); setToId(""); setDecisions({}); }}>
                  <SelectTrigger><SelectValue placeholder="Choose session" /></SelectTrigger>
                  <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}{s.closed_at ? " (closed)" : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Promote into</Label>
                <Select value={toId} onValueChange={setToId}>
                  <SelectTrigger><SelectValue placeholder="Choose new session" /></SelectTrigger>
                  <SelectContent>
                    {sessions.filter((s) => s.id !== fromId && !s.closed_at).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {fromSession && (
              <div className="space-y-3">
                <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {STEPS.map((st) => {
                    const at = fromSession[st.field];
                    return (
                      <li key={st.key} className={`rounded-md border p-2 text-xs ${at ? "border-success/40 bg-success/10" : "border-border"}`}>
                        <span className="flex items-center gap-1.5 font-semibold">
                          {at ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                          {st.label}
                        </span>
                        <span className="text-muted-foreground">{at ? fmtDate(at) : "Not yet"}</span>
                      </li>
                    );
                  })}
                </ol>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {nextStep && (
                    <Button className="h-10" disabled={stepMut.isPending} onClick={() => {
                      if (window.confirm(`Mark "${nextStep.label === "Session closed" ? "Close session" : nextStep.label + " complete"}" for ${fromSession.name}?`)) stepMut.mutate({ step: nextStep.key, done: true });
                    }}>
                      {nextStep.key === "close" ? `Close ${fromSession.name}` : `Mark ${nextStep.label} complete`}
                    </Button>
                  )}
                  {lastStep && (
                    <Button className="h-10" variant="outline" disabled={stepMut.isPending} onClick={() => {
                      if (window.confirm(`Undo "${lastStep.label}" for ${fromSession.name}?`)) stepMut.mutate({ step: lastStep.key, done: false });
                    }}>
                      Undo {lastStep.key === "close" ? "closing" : lastStep.label}
                    </Button>
                  )}
                </div>
                {!ready && (
                  <p className="rounded-md bg-warning/15 p-3 text-xs">
                    Promotion is locked until the First, Second and Third terms are marked complete and the session is closed.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="tsu-shadow">
          <CardHeader>
            <CardTitle className="text-base">2. Promotion policy</CardTitle>
            <CardDescription>Decides who is promoted automatically and who is listed for your review. No pupil is held back automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {policyDraft && (
              <>
                <label className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
                  <span className="text-sm">
                    <span className="font-medium">Require results in all three terms</span>
                    <span className="block text-xs text-muted-foreground">Pupils without approved results in each term are listed for review.</span>
                  </span>
                  <Switch checked={policyDraft.require} onCheckedChange={(v) => setPolicyDraft({ ...policyDraft, require: v })} />
                </label>
                <div className="space-y-1.5">
                  <Label htmlFor="minavg">Minimum session average (optional)</Label>
                  <Input id="minavg" inputMode="decimal" placeholder="Leave blank for no minimum" value={policyDraft.min}
                    onChange={(e) => setPolicyDraft({ ...policyDraft, min: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Pupils below this average are listed for review, not held back automatically.</p>
                </div>
                <Button className="h-10" variant="outline" disabled={policyMut.isPending} onClick={() => policyMut.mutate()}>
                  {policyMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save policy
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="tsu-shadow">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">3. Review the promotion list</CardTitle>
              <CardDescription>
                {plan.promote + plan.special} to promote · {plan.repeat} repeating · {plan.complete} completing · {plan.skip} not processed this time
              </CardDescription>
            </div>
            <Button className="h-11 md:h-10" disabled={!ready || !toId || runMut.isPending || candidates.length === counts.done} onClick={() => setConfirmRun(true)}>
              {runMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
              Run promotion
            </Button>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex flex-wrap gap-2">
              {(["all", "promote", "review", "repeat", "special", "complete", "done"] as const).map((k) => (
                <Button key={k} size="sm" className="h-9" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
                  {k === "all" ? "All" : ACTION_STYLE[k].label} ({k === "all" ? candidates.length : counts[k]})
                </Button>
              ))}
            </div>
            <div className="relative md:ml-auto md:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" className="pl-9" placeholder="Name or reg. number" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {visible.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{fromId ? "No pupils match." : "Choose a completed session."}</p>}

          {visible.length > 0 && isMobile && (
            <ul className="space-y-3 p-3">
              {visible.map((c) => (
                <li key={c.student_id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{c.full_name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{c.matric_number ?? "—"}</p>
                    </div>
                    <Pill className={ACTION_STYLE[c.action].className}>{ACTION_STYLE[c.action].label}</Pill>
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                    <span>{fromClass(c)}</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium">{toClass(c)}</span>
                  </p>
                  {c.reason && <p className="mt-1 text-xs text-muted-foreground">{c.reason}</p>}
                  <div className="mt-3">{decisionSelect(c)}</div>
                </li>
              ))}
            </ul>
          )}

          {visible.length > 0 && !isMobile && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-secondary/50">
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-3 text-center">S/N</th><th className="px-3 py-3">Name</th><th className="px-3 py-3">Reg. No.</th>
                    <th className="px-3 py-3">Current class</th><th className="px-3 py-3">Next class</th><th className="px-3 py-3">Plan</th><th className="px-3 py-3">Your decision</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c, i) => (
                    <tr key={c.student_id} className="border-b last:border-0 even:bg-muted/40">
                      <td className="px-3 py-2.5 text-center text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium">{c.full_name}{c.reason && <span className="block text-xs font-normal text-muted-foreground">{c.reason}</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">{c.matric_number ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{fromClass(c)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium">{toClass(c)}</td>
                      <td className="px-3 py-2.5"><Pill className={ACTION_STYLE[c.action].className}>{ACTION_STYLE[c.action].label}</Pill></td>
                      <td className="px-3 py-2">{decisionSelect(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="text-base">Promotion history{fromSession ? ` — ${fromSession.name}` : ""}</CardTitle>
          <CardDescription>Every promotion is kept permanently. A correction marks the record as reversed and moves the pupil back.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No promotions recorded for this session yet.</p>}
          {history.length > 0 && (
            <ul className="divide-y divide-border">
              {history.map((h) => {
                const from = h.from_dept ? resultsClassLabel(h.from_dept.name, h.from_arm) : "—";
                const to = h.outcome === "completed_programme" ? "Completed programme" : h.to_dept ? (h.to_arm ? resultsClassLabel(h.to_dept.name, h.to_arm) : `${h.to_dept.name} (arm to assign)`) : "—";
                return (
                  <li key={h.id} className={`flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between ${h.status === "reversed" ? "opacity-70" : ""}`}>
                    <div className="min-w-0">
                      <p className="font-medium">
                        {h.student?.full_name ?? "Pupil"} <span className="font-mono text-xs text-muted-foreground">{h.student?.matric_number ?? ""}</span>
                      </p>
                      <p className="flex flex-wrap items-center gap-1.5 text-sm">
                        <span>{from}</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /><span>{to}</span>
                        <Pill className="border-border bg-muted text-foreground">{OUTCOME_LABEL[h.outcome] ?? h.outcome}</Pill>
                        {h.status === "reversed" && <Pill className="border-destructive/30 bg-destructive/10 text-destructive">Reversed</Pill>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(h.created_at)} · into {h.to_session?.name ?? "—"} · by {h.performed_by_label}
                        {h.exception_note ? ` · ${h.exception_note}` : ""}
                        {h.status === "reversed" ? ` · reversed ${fmtDate(h.reversed_at)}: ${h.reversal_reason ?? ""}` : ""}
                      </p>
                    </div>
                    {h.status === "applied" && (
                      <Button size="sm" variant="outline" className="h-9 shrink-0 self-start md:self-center"
                        onClick={() => setReverseTarget({ id: h.id, name: h.student?.full_name ?? "this pupil" })}>
                        <RotateCcw className="mr-1.5 h-4 w-4" /> Correct
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmRun} onOpenChange={setConfirmRun}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote pupils from {fromSession?.name} into {toSession?.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <ul className="list-inside list-disc">
                  <li>{plan.promote + plan.special} promoted to their next class</li>
                  <li>{plan.repeat} repeating their class</li>
                  <li>{plan.complete} completing the school programme</li>
                  <li>{plan.skip} not processed this time (including anyone still awaiting review)</li>
                </ul>
                <p>Results and records are not changed. Any single promotion can be corrected afterwards from the history list.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={runMut.isPending} onClick={(e) => { e.preventDefault(); runMut.mutate(); }}>
              {runMut.isPending ? "Promoting…" : "Run promotion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!reverseTarget} onOpenChange={(o) => { if (!o) { setReverseTarget(null); setReverseReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Correct the promotion for {reverseTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They go back to the class and arm they were in. The record is kept and marked as reversed. They can then be promoted again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rev-reason">Reason</Label>
            <Textarea id="rev-reason" value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} placeholder="e.g. Board decided she should repeat Primary 4" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={reverseReason.trim().length < 5 || reverseMut.isPending} onClick={() => reverseMut.mutate()}>
              {reverseMut.isPending ? "Saving…" : "Reverse promotion"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!specialTarget} onOpenChange={(o) => { if (!o) setSpecialTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Special promotion for {specialTarget?.full_name}</AlertDialogTitle>
            <AlertDialogDescription>Send this pupil to a specific class at promotion, with the approval on record.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Move to class</Label>
              <Select value={specialDept} onValueChange={setSpecialDept}>
                <SelectTrigger><SelectValue placeholder="Choose class" /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-note">Approved by / reason</Label>
              <Textarea id="sp-note" value={specialNote} onChange={(e) => setSpecialNote(e.target.value)} placeholder="e.g. Double promotion approved by the Head Teacher" />
            </div>
          </div>
          <AlertDialogFooter>
            {specialTarget?.action === "special" && (
              <Button variant="outline" disabled={specialMut.isPending} onClick={() => specialMut.mutate(true)}>Remove special promotion</Button>
            )}
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button disabled={!specialDept || specialNote.trim().length < 3 || specialMut.isPending} onClick={() => specialMut.mutate(false)}>Save</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
