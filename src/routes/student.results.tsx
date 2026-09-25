import { createFileRoute } from "@tanstack/react-router";
import { ProtectedStudent } from "@/components/ProtectedStudent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { computeGrade, effectiveTotal } from "@/lib/grading";
import { useMemo } from "react";

export const Route = createFileRoute("/student/results")({
  head: () => ({ meta: [{ title: "My Results — School Portal" }] }),
  component: () => <ProtectedStudent><ResultsPage /></ProtectedStudent>,
});

function ResultsPage() {
  const { session } = useAuthSession();
  const { data: student } = useQuery({
    queryKey: ["s-id", session?.user.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("students").select("id, full_name, matric_number").eq("user_id", session!.user.id).maybeSingle()).data,
  });

  const { data: results = [] } = useQuery({
    queryKey: ["my-results", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("results")
        .select("id, ca_score, exam_score, total_score, semester, courses(code, title), academic_sessions(name)")
        .eq("student_id", student!.id);
      return data ?? [];
    },
  });

  // Group by Session + Term — a pupil's results are recorded per term, not
  // per "level", since a primary/secondary pupil is simply in one class at
  // a time.
  const grouped = useMemo(() => {
    const map = new Map<string, typeof results>();
    for (const r of results) {
      const key = `${(r.academic_sessions as { name?: string } | null)?.name ?? "—"} • ${r.semester} Term`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries());
  }, [results]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">My Results</h2>
        <p className="text-sm text-muted-foreground">Results are recorded per term. Select a term below to see the breakdown.</p>
      </div>

      {grouped.length === 0 && (
        <Card className="tsu-shadow"><CardContent className="py-10 text-center text-muted-foreground">No results have been published yet.</CardContent></Card>
      )}

      {grouped.map(([label, rows]) => {
        const totalScore = rows.reduce((s, r) => s + effectiveTotal(r), 0);
        const average = rows.length ? totalScore / rows.length : 0;
        return (
          <Card key={label} className="tsu-shadow">
            <CardHeader><CardTitle className="text-base">{label} — Average {average.toFixed(1)}%</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const total = effectiveTotal(r);
                    const { grade } = computeGrade(total);
                    const c = r.courses as { code?: string; title?: string } | null;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono font-medium">{c?.code}</TableCell>
                        <TableCell>{c?.title}</TableCell>
                        <TableCell className="text-center">{total}</TableCell>
                        <TableCell className="text-center font-bold">{grade}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
