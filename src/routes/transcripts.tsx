import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCollegeSettings } from "@/lib/college-settings";
import { effectiveTotal, autoRemark } from "@/lib/grading";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { generateReportSheetPdf } from "@/lib/report-sheet";

export const Route = createFileRoute("/transcripts")({
  head: () => ({ meta: [{ title: "Report Cards — School Portal" }] }),
  component: () => <ProtectedAdmin><ReportCardsPage /></ProtectedAdmin>,
});

const TERMS = ["First", "Second", "Third"] as const;
const TERM_ORDER: Record<string, number> = { First: 1, Second: 2, Third: 3 };

interface ResultRow {
  id: string;
  semester: string;
  ca_score: number;
  exam_score: number;
  total_score: number | null;
  session_id: string;
  courses: { code: string; title: string } | null;
  academic_sessions: { name: string } | null;
}

interface StudentRow {
  id: string;
  full_name: string;
  matric_number: string;
  class_arm_id: string | null;
}

interface CommentRow {
  session_id: string;
  term: string;
  class_teacher_comment: string | null;
  head_teacher_comment: string | null;
  academic_sessions: { name: string } | null;
}

export function ReportCardsPage() {
  const { settings } = useCollegeSettings();
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState<string | undefined>();
  const [startSession, setStartSession] = useState<string | undefined>();
  const [startTerm, setStartTerm] = useState("First");
  const [endSession, setEndSession] = useState<string | undefined>();
  const [endTerm, setEndTerm] = useState("Third");

  const { data: students = [] } = useQuery({
    queryKey: ["students-all"],
    queryFn: async () => ((await supabase.from("students").select("id, full_name, matric_number, class_arm_id").order("full_name")).data ?? []) as StudentRow[],
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => (await supabase.from("academic_sessions").select("*").order("name")).data ?? [],
  });

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students.slice(0, 20);
    return students.filter((s) => s.full_name.toLowerCase().includes(q) || s.matric_number.toLowerCase().includes(q)).slice(0, 20);
  }, [students, search]);

  const student = students.find((s) => s.id === studentId);

  const { data: classArm } = useQuery({
    queryKey: ["student-class-label", student?.class_arm_id],
    enabled: !!student?.class_arm_id,
    queryFn: async () => (await supabase.from("class_arms").select("name, departments:department_id(name)").eq("id", student!.class_arm_id!).maybeSingle()).data,
  });
  const classLabel = classArm ? `${(classArm.departments as { name?: string } | null)?.name ?? ""} ${classArm.name}`.trim() : "—";

  const { data: allResults = [] } = useQuery<ResultRow[]>({
    queryKey: ["transcript-results", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase.from("results")
        .select("id, semester, ca_score, exam_score, total_score, session_id, courses(code, title), academic_sessions(name)")
        .eq("student_id", studentId!)
        .eq("status", "published");
      if (error) throw error;
      return (data ?? []) as unknown as ResultRow[];
    },
  });

  const sessionRank = (id: string) => sessions.find((s) => s.id === id)?.name ?? ""; // names like "2026/2027" sort lexically

  const { data: comments = [] } = useQuery<CommentRow[]>({
    queryKey: ["transcript-comments", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_card_comments")
        .select("session_id, term, class_teacher_comment, head_teacher_comment, academic_sessions(name)")
        .eq("student_id", studentId!);
      if (error) throw error;
      return (data ?? []) as unknown as CommentRow[];
    },
  });

  const inRange = (r: ResultRow): boolean => {
    if (!startSession || !endSession) return true;
    const key = (sess: string, sem: string) => `${sess}|${TERM_ORDER[sem] ?? 0}`;
    const k = key(sessionRank(r.session_id), r.semester);
    const ks = key(sessionRank(startSession), startTerm);
    const ke = key(sessionRank(endSession), endTerm);
    return k >= ks && k <= ke;
  };

  const inRangeResults = useMemo(() => allResults.filter(inRange), [allResults, startSession, endSession, startTerm, endTerm]);

  // Group by Session + Term — a pupil's results are recorded per term, not
  // per "level"; a primary/secondary pupil is in one class at a time.
  const groups = useMemo(() => {
    const m = new Map<string, { sessionName: string; semester: string; rows: ResultRow[] }>();
    for (const r of inRangeResults) {
      const sn = r.academic_sessions?.name ?? "—";
      const k = `${sn}__${r.semester}`;
      if (!m.has(k)) m.set(k, { sessionName: sn, semester: r.semester, rows: [] });
      m.get(k)!.rows.push(r);
    }
    return Array.from(m.values()).sort((a, b) => {
      if (a.sessionName !== b.sessionName) return a.sessionName.localeCompare(b.sessionName);
      return (TERM_ORDER[a.semester] ?? 0) - (TERM_ORDER[b.semester] ?? 0);
    });
  }, [inRangeResults]);

  const averageOf = (rows: ResultRow[]) => {
    if (rows.length === 0) return 0;
    return rows.reduce((s, r) => s + effectiveTotal(r), 0) / rows.length;
  };

  const overallAverage = useMemo(() => averageOf(inRangeResults), [inRangeResults]);

  const validateRange = () => {
    if (!startSession || !endSession) return "Pick start and end sessions";
    const sKey = `${sessionRank(startSession)}|${TERM_ORDER[startTerm]}`;
    const eKey = `${sessionRank(endSession)}|${TERM_ORDER[endTerm]}`;
    if (sKey > eKey) return "Start must be before End";
    return null;
  };

  const handleGenerate = () => {
    if (!student) { toast.error("Select a pupil"); return; }
    const err = validateRange();
    if (err) { toast.error(err); return; }
    if (groups.length === 0) { toast.error("No results in selected range"); return; }

    // Every term is printed on the school's own sheet — the same layout
    // and columns the Exam Officer and parents see — one page per term,
    // in one downloadable PDF.
    let doc: ReturnType<typeof generateReportSheetPdf> | undefined;
    groups.forEach((g, i) => {
      const matchingComment = comments.find((c) => (c.academic_sessions?.name ?? "—") === g.sessionName && c.term === g.semester);
      const average = averageOf(g.rows);
      const firstName = student.full_name.trim().split(/\s+/)[0];
      doc = generateReportSheetPdf(
        {
          student: { full_name: student.full_name, admission_number: student.matric_number },
          className: classLabel,
          sessionName: g.sessionName,
          term: g.semester,
          subjects: g.rows.map((r) => ({
            code: r.courses?.code ?? "",
            title: r.courses?.title ?? "",
            ca: r.ca_score,
            exam: r.exam_score,
            total: effectiveTotal(r),
          })),
          position: null, // position needs the pupil's classmates for this term — not fetched by this multi-term view
          classSize: null,
          comments: {
            classTeacher: matchingComment?.class_teacher_comment ?? autoRemark(average, settings.grading_scale, firstName),
            headTeacher: matchingComment?.head_teacher_comment ?? null,
          },
          gradingScale: settings.grading_scale,
        },
        { doc, save: false },
      );
    });

    doc?.save(`report-card_${student.matric_number.replace(/[\/\\]/g, "_")}.pdf`);
    toast.success("Report Card downloaded");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Report Cards</h2>
        <p className="text-sm text-muted-foreground">Generate a PDF report card for any pupil across a chosen term range.</p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">1. Select Pupil</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Search by name or admission number</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. Sadiq or PR/26/0091" />
            </div>
            <div className="space-y-1.5">
              <Label>Pupil</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder={`${filteredStudents.length} match(es)`} /></SelectTrigger>
                <SelectContent>
                  {filteredStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.matric_number} — {s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="text-base">2. Range</CardTitle>
          <CardDescription>Define the start and end term of the report card.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Start</p>
            <RangePicker session={startSession} setSession={setStartSession} term={startTerm} setTerm={setStartTerm} sessions={sessions} />
          </div>
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">End</p>
            <RangePicker session={endSession} setSession={setEndSession} term={endTerm} setTerm={setEndTerm} sessions={sessions} />
          </div>
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">3. Preview &amp; Generate</CardTitle>
            <CardDescription>{groups.length} term(s) &middot; Overall Average {overallAverage.toFixed(1)}%</CardDescription>
          </div>
          <Button onClick={handleGenerate} disabled={!student || groups.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Generate PDF
          </Button>
        </CardHeader>
        <CardContent>
          {!student && <p className="text-sm text-muted-foreground">Select a pupil to preview.</p>}
          {student && groups.length === 0 && <p className="text-sm text-muted-foreground">No results found in the selected range.</p>}
          {student && groups.length > 0 && (
            <ul className="space-y-1 text-sm">
              {groups.map((g, i) => {
                const avg = averageOf(g.rows);
                return (
                  <li key={i} className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2">
                    <span>{g.sessionName} &middot; {g.semester} Term</span>
                    <span className="text-xs text-muted-foreground">{g.rows.length} subjects &middot; Average {avg.toFixed(1)}%</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RangePicker({ session, setSession, term, setTerm, sessions }: {
  session: string | undefined; setSession: (v: string) => void;
  term: string; setTerm: (v: string) => void;
  sessions: { id: string; name: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Select value={session} onValueChange={setSession}>
        <SelectTrigger><SelectValue placeholder="Session" /></SelectTrigger>
        <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={term} onValueChange={setTerm}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{TERMS.map((s) => <SelectItem key={s} value={s}>{s} Term</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
