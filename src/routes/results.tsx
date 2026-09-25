import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeGrade, effectiveTotal } from "@/lib/grading";
import { FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/results")({
  head: () => ({ meta: [{ title: "View / Export Results — School Portal" }] }),
  component: () => <ProtectedAdmin><ResultsViewPage /></ProtectedAdmin>,
});

const TERMS = ["First", "Second", "Third"] as const;

interface ResultJoined {
  id: string;
  student_id: string;
  course_id: string;
  ca_score: number;
  exam_score: number;
  total_score: number | null;
  semester: string;
  session_id: string;
  students: { matric_number: string; full_name: string } | null;
  courses: { code: string; title: string } | null;
}

export function ResultsViewPage() {
  const [sessionId, setSessionId] = useState("");
  const [semester, setTerm] = useState("First");
  const [classArmId, setClassArmId] = useState("");

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => (await supabase.from("academic_sessions").select("*").order("name", { ascending: false })).data ?? [],
  });

  const { data: classArms = [] } = useQuery({
    queryKey: ["class-arms-for-results"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_arms")
        .select("id, name, departments:department_id(name)")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; departments: { name: string } | null }[];
    },
  });

  const { data: results = [], isLoading } = useQuery<ResultJoined[]>({
    queryKey: ["results", sessionId, semester, classArmId],
    enabled: !!sessionId && !!classArmId,
    queryFn: async () => {
      const { data: classStudents, error: sErr } = await supabase.from("students").select("id").eq("class_arm_id", classArmId);
      if (sErr) throw sErr;
      const studentIds = (classStudents ?? []).map((s) => s.id);
      if (studentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("results")
        .select("id, student_id, course_id, session_id, semester, ca_score, exam_score, total_score, students(matric_number, full_name), courses(code, title)")
        .eq("session_id", sessionId)
        .eq("semester", semester)
        .in("student_id", studentIds);
      if (error) throw error;
      return (data ?? []) as unknown as ResultJoined[];
    },
  });

  // Group results by student
  const grouped = useMemo(() => {
    const m = new Map<string, { matric: string; name: string; rows: ResultJoined[] }>();
    for (const r of results) {
      const key = r.student_id;
      if (!m.has(key)) m.set(key, { matric: r.students?.matric_number ?? "—", name: r.students?.full_name ?? "—", rows: [] });
      m.get(key)!.rows.push(r);
    }
    return Array.from(m.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [results]);

  const averageFor = (sid: string): number => {
    const rows = results.filter((r) => r.student_id === sid);
    if (rows.length === 0) return 0;
    return rows.reduce((s, r) => s + effectiveTotal(r), 0) / rows.length;
  };

  const handleExport = () => {
    if (grouped.length === 0) { toast.error("Nothing to export"); return; }
    const sessionName = sessions.find((s) => s.id === sessionId)?.name ?? "session";
    const className = classArms.find((c) => c.id === classArmId);
    const classLabel = className ? (className.departments?.name ? `${className.departments.name} ${className.name}` : className.name) : "Class";

    const detailRows = results.map((r) => {
      const total = effectiveTotal(r);
      const { grade } = computeGrade(total);
      return {
        "Admission Number": r.students?.matric_number ?? "",
        "Name": r.students?.full_name ?? "",
        "Subject Code": r.courses?.code ?? "",
        "Subject Title": r.courses?.title ?? "",
        "CA (40)": Number(r.ca_score),
        "Exam (70)": Number(r.exam_score),
        "Total (100)": total,
        "Grade": grade,
      };
    }).sort((a, b) => a["Name"].localeCompare(b["Name"]) || a["Subject Code"].localeCompare(b["Subject Code"]));

    const summary = grouped.map(([sid, info]) => ({
      "Admission Number": info.matric,
      "Name": info.name,
      "Subjects": info.rows.length,
      "Term Average (%)": Number(averageFor(sid).toFixed(1)),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "Result Sheet");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Term Averages");
    const fname = `Kazaure_Results_${sessionName.replace("/", "-")}_${semester}Term_${classLabel.replace(/\s+/g, "-")}.xlsx`;
    XLSX.writeFile(wb, fname);
    toast.success(`Exported ${fname}`);
  };

  const sessionName = sessions.find((s) => s.id === sessionId)?.name;
  const classLabel = useMemo(() => {
    const c = classArms.find((a) => a.id === classArmId);
    return c ? (c.departments?.name ? `${c.departments.name} ${c.name}` : c.name) : "";
  }, [classArms, classArmId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">View &amp; Export Results</h2>
        <p className="text-sm text-muted-foreground">Pick a session, term, and class to view the result sheet. Results are recorded per term.</p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Session</Label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger><SelectValue placeholder={sessions.length ? "Select session" : "Create a session first"} /></SelectTrigger>
                <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Term</Label>
              <Select value={semester} onValueChange={setTerm}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TERMS.map((s) => <SelectItem key={s} value={s}>{s} Term</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select value={classArmId} onValueChange={setClassArmId}>
                <SelectTrigger><SelectValue placeholder={classArms.length ? "Select class" : "Set up classes first"} /></SelectTrigger>
                <SelectContent>{classArms.map((c) => <SelectItem key={c.id} value={c.id}>{c.departments?.name ? `${c.departments.name} ${c.name}` : c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleExport} disabled={grouped.length === 0} className="w-full sm:w-auto">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Export to Excel
          </Button>
        </CardContent>
      </Card>

      {(!sessionId || !classArmId) && (
        <Card className="tsu-shadow"><CardContent className="py-10 text-center text-muted-foreground">Select a session and class to load results.</CardContent></Card>
      )}

      {sessionId && classArmId && isLoading && (
        <Card className="tsu-shadow"><CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent></Card>
      )}

      {sessionId && classArmId && !isLoading && grouped.length === 0 && (
        <Card className="tsu-shadow"><CardContent className="py-10 text-center text-muted-foreground">No results recorded for this scope.</CardContent></Card>
      )}

      {grouped.length > 0 && (
        <Card className="tsu-shadow">
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              Result Sheet — {sessionName} · {semester} Term · {classLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {grouped.map(([sid, info]) => {
              const avg = averageFor(sid);
              return (
                <div key={sid} className="rounded-md border border-border">
                  <div className="flex flex-col gap-1 border-b border-border bg-secondary/50 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <p className="font-semibold text-foreground">{info.name}</p>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <Stat label="Term Average" value={`${avg.toFixed(1)}%`} />
                      <Stat label="Subjects" value={String(info.rows.length)} />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead className="text-center">CA</TableHead>
                          <TableHead className="text-center">Exam</TableHead>
                          <TableHead className="text-center">Total</TableHead>
                          <TableHead className="text-center">Grade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {info.rows.map((r) => {
                          const total = effectiveTotal(r);
                          const g = computeGrade(total);
                          return (
                            <TableRow key={r.id}>
                              <TableCell className="font-mono">{r.courses?.code}</TableCell>
                              <TableCell>{r.courses?.title}</TableCell>
                              <TableCell className="text-center">{Number(r.ca_score)}</TableCell>
                              <TableCell className="text-center">{Number(r.exam_score)}</TableCell>
                              <TableCell className="text-center font-medium">{total}</TableCell>
                              <TableCell className="text-center">
                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${g.grade === "F" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>{g.grade}</span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-card px-3 py-1.5 text-center tsu-shadow">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-bold text-primary">{value}</p>
    </div>
  );
}
