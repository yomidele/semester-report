import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProtectedExamOfficer } from "@/components/ProtectedExamOfficer";
import { supabase } from "@/integrations/supabase/client";
import { examOfficerApproveResults, examOfficerPublishResults, examOfficerReturnResults } from "@/lib/result-workflow.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";

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
      const { data, error } = await supabase.from("results").select("id, student_id, course_id, session_id, semester, ca_score, exam_score, total_score, status, returned_reason, students(full_name, matric_number), courses(title, code), academic_sessions(name)").in("status", ["submitted", "approved"]).order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const transition = useMutation({
    mutationFn: async ({ kind, id }: { kind: "approve" | "publish" | "return"; id: string }) => {
      const data = { result_ids: [id] };
      if (kind === "approve") return approve({ data });
      if (kind === "publish") return publish({ data });
      return returnResults({ data: { ...data, reason: "Returned by Exam Officer for correction" } });
    },
    onSuccess: () => { toast.success("Result status updated"); qc.invalidateQueries({ queryKey: ["exam-officer-results-review"] }); qc.invalidateQueries({ queryKey: ["eo-pending-count"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  return <div className="space-y-6">
    <div><h1 className="font-serif text-2xl font-bold">Review Results</h1><p className="text-sm text-muted-foreground">Check submitted scores, approve results, return corrections, and finalize approved results for publication.</p></div>
    <Card><CardHeader><CardTitle className="text-base">Submitted and approved results</CardTitle></CardHeader><CardContent className="overflow-x-auto">
      {results.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Pupil</th><th className="pr-3">Subject</th><th className="pr-3">Session / Term</th><th className="pr-3">CA</th><th className="pr-3">Exam</th><th className="pr-3">Total</th><th className="pr-3">Status</th><th>Actions</th></tr></thead><tbody>{(results.data ?? []).map((result: any) => <tr key={result.id} className="border-b"><td className="py-3 pr-3">{result.students?.full_name}<span className="block text-xs text-muted-foreground">{result.students?.matric_number}</span></td><td className="pr-3">{result.courses?.title ?? result.courses?.code}</td><td className="pr-3">{result.academic_sessions?.name} / {result.semester}</td><td className="pr-3">{result.ca_score}</td><td className="pr-3">{result.exam_score}</td><td className="pr-3">{result.total_score ?? Number(result.ca_score) + Number(result.exam_score)}</td><td className="pr-3 capitalize">{result.status}</td><td><div className="flex gap-1">{result.status === "submitted" && <><Button size="sm" disabled={transition.isPending} onClick={() => transition.mutate({ kind: "approve", id: result.id })}><Check className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" disabled={transition.isPending} onClick={() => transition.mutate({ kind: "return", id: result.id })}><RotateCcw className="mr-1 h-4 w-4" />Return</Button></>}{result.status === "approved" && <Button size="sm" disabled={transition.isPending} onClick={() => transition.mutate({ kind: "publish", id: result.id })}><Send className="mr-1 h-4 w-4" />Publish</Button>}</div></td></tr>)}</tbody></table>}
      {!results.isLoading && results.data?.length === 0 && <p className="py-5 text-sm text-muted-foreground">No results are awaiting review or publication.</p>}
    </CardContent></Card>
  </div>;
}
