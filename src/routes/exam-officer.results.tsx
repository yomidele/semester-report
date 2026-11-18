import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProtectedExamOfficer } from "@/components/ProtectedExamOfficer";
import { supabase } from "@/integrations/supabase/client";
import { examOfficerApproveResults, examOfficerPublishResults, examOfficerReturnResults } from "@/lib/result-workflow.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, RotateCcw, Send, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { resultsClassLabel } from "@/lib/class-display";
import { ResultStatusBadge } from "@/components/ResultEntryParts";

export const Route = createFileRoute("/exam-officer/results")({
  head: () => ({ meta: [{ title: "Result Review — Exam Officer" }] }),
  component: () => <ProtectedExamOfficer><Page /></ProtectedExamOfficer>,
});

function Page() {
  const qc = useQueryClient();
  const approve = useServerFn(examOfficerApproveResults);
  const publish = useServerFn(examOfficerPublishResults);
  const returnResults = useServerFn(examOfficerReturnResults);
  const results = useQuery({
    queryKey: ["exam-officer-results-review"],
    queryFn: async () => {
      const { data, error } = await supabase.from("results").select("id, student_id, course_id, session_id, semester, ca_score, exam_score, total_score, status, returned_reason, students(full_name, matric_number, class_arms:class_arm_id(name, code, departments:department_id(name))), courses(title, code), academic_sessions(name)").in("status", ["submitted", "approved"]).order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const transition = useMutation({
    mutationFn: async ({ kind, id }: { kind: "approve" | "publish" | "return"; id: string }) => {
      const data = { result_ids: [id] };
      if (kind === "approve") return approve({ data });
      if (kind === "publish") return publish({ data });
      const reason = window.prompt("Reason for returning this result to the teacher (they will see this):", "");
      if (!reason || reason.trim().length < 5) throw new Error("A reason is required to return a result.");
      return returnResults({ data: { ...data, reason: reason.trim() } });
    },
    onSuccess: () => { toast.success("Result status updated"); qc.invalidateQueries({ queryKey: ["exam-officer-results-review"] }); qc.invalidateQueries({ queryKey: ["eo-pending-count"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const submittedIds = (results.data ?? []).filter((r: any) => r.status === "submitted").map((r: any) => r.id);
  const approvedIds = (results.data ?? []).filter((r: any) => r.status === "approved").map((r: any) => r.id);

  const bulkTransition = useMutation({
    mutationFn: async ({ kind, ids }: { kind: "approve" | "publish"; ids: string[] }) => {
      const data = { result_ids: ids };
      return kind === "approve" ? approve({ data }) : publish({ data });
    },
    onSuccess: (_data, { kind, ids }) => {
      toast.success(`${ids.length} result${ids.length === 1 ? "" : "s"} ${kind === "approve" ? "approved" : "published"}`);
      qc.invalidateQueries({ queryKey: ["exam-officer-results-review"] });
      qc.invalidateQueries({ queryKey: ["eo-pending-count"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleBulk = (kind: "approve" | "publish", ids: string[]) => {
    if (ids.length === 0) return;
    const verb = kind === "approve" ? "approve" : "publish";
    if (!window.confirm(`${verb === "approve" ? "Approve" : "Publish"} all ${ids.length} ${verb === "publish" ? "approved " : ""}result${ids.length === 1 ? "" : "s"}${verb === "publish" ? "? They will immediately become visible on report cards and to PIN holders." : "?"}`)) return;
    bulkTransition.mutate({ kind, ids });
  };

  const bulkBusy = bulkTransition.isPending || transition.isPending;

  const classOf = (result: any) => {
    const arm = result.students?.class_arms;
    return arm ? resultsClassLabel(arm.departments?.name ?? "", arm) : "—";
  };
  const totalOf = (result: any) => result.total_score ?? Number(result.ca_score) + Number(result.exam_score);
  const actions = (result: any) => (
    <div className="flex flex-wrap gap-2">
      {result.status === "submitted" && <>
        <Button size="sm" className="h-9" disabled={bulkBusy} onClick={() => transition.mutate({ kind: "approve", id: result.id })}><Check className="mr-1 h-4 w-4" />Approve</Button>
        <Button size="sm" className="h-9" variant="outline" disabled={bulkBusy} onClick={() => transition.mutate({ kind: "return", id: result.id })}><RotateCcw className="mr-1 h-4 w-4" />Return</Button>
      </>}
      {result.status === "approved" && <Button size="sm" className="h-9" disabled={bulkBusy} onClick={() => transition.mutate({ kind: "publish", id: result.id })}><Send className="mr-1 h-4 w-4" />Publish</Button>}
    </div>
  );
  const rows = results.data ?? [];

  return <div className="space-y-6">
    <div><h1 className="font-serif text-2xl font-bold">Review Results</h1><p className="text-sm text-muted-foreground">Check submitted scores, approve results, return corrections, and finalize approved results for publication.</p></div>
    <Card className="tsu-shadow"><CardHeader className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <CardTitle className="text-base">Submitted and approved results</CardTitle>
      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:flex">
        <Button className="h-10" variant="outline" disabled={bulkBusy || submittedIds.length === 0} onClick={() => handleBulk("approve", submittedIds)}>
          {bulkTransition.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-1 h-4 w-4" />}
          Approve all{submittedIds.length > 0 ? ` (${submittedIds.length})` : ""}
        </Button>
        <Button className="h-10" disabled={bulkBusy || approvedIds.length === 0} onClick={() => handleBulk("publish", approvedIds)}>
          {bulkTransition.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
          Publish all{approvedIds.length > 0 ? ` (${approvedIds.length})` : ""}
        </Button>
      </div>
    </CardHeader><CardContent className="p-0 md:p-6 md:pt-0">
      {results.isLoading && <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading results…</div>}

      {/* Phones: one card per result */}
      {!results.isLoading && rows.length > 0 && <ul className="space-y-3 p-3 md:hidden">
        {rows.map((result: any) => <li key={result.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words font-semibold leading-snug">{result.students?.full_name}</p>
              <p className="text-xs text-muted-foreground">{classOf(result)} · <span className="font-mono">{result.students?.matric_number ?? "—"}</span></p>
            </div>
            <ResultStatusBadge status={result.status} />
          </div>
          <p className="mt-2 text-sm">{result.courses?.title ?? result.courses?.code}</p>
          <p className="text-xs text-muted-foreground">{result.academic_sessions?.name} · {result.semester} Term</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-secondary/40 p-2 text-center">
            <div><dt className="text-[11px] uppercase text-muted-foreground">CA</dt><dd className="font-semibold tabular-nums">{result.ca_score}</dd></div>
            <div><dt className="text-[11px] uppercase text-muted-foreground">Exam</dt><dd className="font-semibold tabular-nums">{result.exam_score}</dd></div>
            <div><dt className="text-[11px] uppercase text-muted-foreground">Total</dt><dd className="font-bold tabular-nums">{totalOf(result)}</dd></div>
          </dl>
          <div className="mt-3">{actions(result)}</div>
        </li>)}
      </ul>}

      {/* Tablet / desktop: table */}
      {!results.isLoading && rows.length > 0 && <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-secondary/50"><tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-3 text-center">S/N</th><th className="px-3 py-3">Name</th><th className="px-3 py-3">Class</th><th className="px-3 py-3">Reg. No.</th><th className="px-3 py-3">Subject</th><th className="px-3 py-3">Session / Term</th><th className="px-3 py-3 text-center">CA</th><th className="px-3 py-3 text-center">Exam</th><th className="px-3 py-3 text-center">Total</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th>
          </tr></thead>
          <tbody>{rows.map((result: any, i: number) => <tr key={result.id} className="border-b last:border-0 even:bg-muted/40">
            <td className="px-3 py-3 text-center text-muted-foreground tabular-nums">{i + 1}</td>
            <td className="px-3 py-3 font-medium">{result.students?.full_name}</td>
            <td className="whitespace-nowrap px-3 py-3">{classOf(result)}</td>
            <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-muted-foreground">{result.students?.matric_number ?? "—"}</td>
            <td className="px-3 py-3">{result.courses?.title ?? result.courses?.code}</td>
            <td className="whitespace-nowrap px-3 py-3">{result.academic_sessions?.name} / {result.semester}</td>
            <td className="px-3 py-3 text-center tabular-nums">{result.ca_score}</td>
            <td className="px-3 py-3 text-center tabular-nums">{result.exam_score}</td>
            <td className="px-3 py-3 text-center font-bold tabular-nums">{totalOf(result)}</td>
            <td className="px-3 py-3"><ResultStatusBadge status={result.status} /></td>
            <td className="px-3 py-3">{actions(result)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      {!results.isLoading && rows.length === 0 && <p className="p-4 text-sm text-muted-foreground md:px-0">No results are awaiting review or publication.</p>}
    </CardContent></Card>
  </div>;
}
