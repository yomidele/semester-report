import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedExamOfficer } from "@/components/ProtectedExamOfficer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, Files } from "lucide-react";
import { toast } from "sonner";
import { useCollegeSettings } from "@/lib/college-settings";
import { generateReportSheetPdf, orderSubjects, type ReportSheetData } from "@/lib/report-sheet";
import { effectiveTotal, rankByAverage, autoRemark } from "@/lib/grading";

export const Route = createFileRoute("/exam-officer/report-sheets")({
  head: () => ({ meta: [{ title: "Report Sheets — Exam Officer" }] }),
  component: () => <ProtectedExamOfficer><Page /></ProtectedExamOfficer>,
});

// Supabase returns at most 1,000 rows per request. A whole class's published
// results can exceed that, and a silently-truncated list would produce wrong
// class positions — so large reads are fetched page by page, and long id lists
// are split so the request URL stays a sensible length.
const PAGE_SIZE = 1000;
const ID_CHUNK = 100;

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

async function fetchAll<T>(
  make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await make(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return out;
}

function Page() {
  const { settings } = useCollegeSettings();
  const [departmentId, setDepartmentId] = useState("");
  const [classArmId, setClassArmId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [term, setTerm] = useState("First");
  const [nextTermBegins, setNextTermBegins] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const departmentsQ = useQuery({ queryKey: ["departments-with-faculty"], queryFn: async () => (await supabase.from("departments").select("id, name").order("name")).data ?? [] });
  const armsQ = useQuery({ queryKey: ["class-arms-all"], queryFn: async () => (await supabase.from("class_arms").select("id, name, department_id").order("name")).data ?? [] });
  const sessionsQ = useQuery({ queryKey: ["sessions"], queryFn: async () => (await supabase.from("academic_sessions").select("id, name").order("created_at", { ascending: false })).data ?? [] });

  const armsForClass = useMemo(() => (armsQ.data ?? []).filter((a) => a.department_id === departmentId), [armsQ.data, departmentId]);
  const selectedDept = departmentsQ.data?.find((d) => d.id === departmentId);
  const selectedArm = armsQ.data?.find((a) => a.id === classArmId);
  const className = selectedDept ? (selectedArm ? `${selectedDept.name} — ${selectedArm.name}` : selectedDept.name) : "";
  const selectedSession = sessionsQ.data?.find((s) => s.id === sessionId);

  const studentsQ = useQuery({
    queryKey: ["arm-students", departmentId, classArmId],
    enabled: Boolean(departmentId),
    queryFn: async () => {
      let q = supabase.from("students").select("id, full_name, matric_number, class_arm_id").eq("status", "active").eq("department_id", departmentId);
      if (classArmId) q = q.eq("class_arm_id", classArmId);
      const { data, error } = await q.order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const roster = studentsQ.data ?? [];
  // Only ids still in the listed roster count, so changing class/arm can never
  // leave a hidden pupil from the previous list selected.
  const selectedInRoster = roster.filter((s) => selectedIds.has(s.id));
  const allSelected = roster.length > 0 && selectedInRoster.length === roster.length;

  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(roster.map((s) => s.id)));

  /**
   * Builds the report-sheet data for the given pupils in one pass: the whole
   * class's published results are loaded once (needed anyway for class
   * averages and positions), then each pupil's sheet is assembled from that.
   * Pupils with no published results for this session/term are returned in
   * `skipped` instead of producing a blank sheet.
   */
  const buildSheets = async (studentIds: string[]) => {
    const rs = ((settings as unknown as { report_card_settings?: Record<string, string> | null }).report_card_settings ?? {}) as Record<string, string>;
    const classmateIds = roster.map((r) => r.id);

    // Published results for the whole listed class (ranks + each pupil's own rows).
    const classResults: any[] = [];
    for (const ids of chunk(classmateIds, ID_CHUNK)) {
      classResults.push(
        ...(await fetchAll<any>((from, to) =>
          supabase
            .from("results")
            .select("student_id, course_id, ca_score, exam_score, total_score, courses:course_id(code, title)")
            .in("student_id", ids)
            .eq("session_id", sessionId)
            .eq("semester", term)
            .eq("status", "published")
            .range(from, to),
        )),
      );
    }

    const comments: any[] = [];
    for (const ids of chunk(studentIds, ID_CHUNK)) {
      const { data, error } = await supabase
        .from("report_card_comments")
        .select("student_id, class_teacher_comment, head_teacher_comment, conduct_rating")
        .in("student_id", ids)
        .eq("session_id", sessionId)
        .eq("term", term);
      if (error) throw new Error(error.message);
      comments.push(...(data ?? []));
    }

    const armIds = [...new Set(roster.filter((r) => studentIds.includes(r.id) && r.class_arm_id).map((r) => r.class_arm_id as string))];
    const classSubjects: any[] = [];
    if (armIds.length > 0) {
      const { data, error } = await supabase
        .from("class_subjects")
        .select("class_arm_id, course_id, courses:course_id(code, title)")
        .in("class_arm_id", armIds);
      if (error) throw new Error(error.message);
      classSubjects.push(...(data ?? []));
    }

    // Class averages and positions, across everyone in the listed class.
    const totalsByStudent = new Map<string, number[]>();
    classResults.forEach((r) => {
      const arr = totalsByStudent.get(r.student_id) ?? [];
      arr.push(effectiveTotal(r));
      totalsByStudent.set(r.student_id, arr);
    });
    const averages = Array.from(totalsByStudent.entries()).map(([id, totals]) => ({
      id,
      avg: totals.reduce((a, b) => a + b, 0) / (totals.length || 1),
    }));
    const ranks = rankByAverage(averages.map((a) => ({ id: a.id, average: a.avg })));
    const avgById = new Map(averages.map((a) => [a.id, a.avg]));

    const sheets: ReportSheetData[] = [];
    const skipped: string[] = [];

    for (const studentId of studentIds) {
      const student = roster.find((r) => r.id === studentId);
      if (!student) continue;
      const own = classResults.filter((r) => r.student_id === studentId);
      if (own.length === 0) { skipped.push(student.full_name); continue; }

      const rank = ranks.get(studentId) ?? 0;
      const firstName = student.full_name.trim().split(/\s+/)[0];
      // A remark the class teacher actually typed always wins; otherwise the
      // sheet still leaves the school's own remark section filled in rather
      // than blank, generated from this term's actual average.
      const autoClassTeacherRemark = autoRemark(avgById.get(studentId) ?? 0, settings.grading_scale, firstName);
      const comment = comments.find((c) => c.student_id === studentId);

      // Rows = every subject taught to this pupil's class arm (blank when no
      // published score yet, like the printed sheet) plus any scored subject.
      const byCourse = new Map<string, { code: string; title: string; ca: number | null; exam: number | null; total: number | null }>();
      classSubjects
        .filter((cs) => cs.class_arm_id === student.class_arm_id)
        .forEach((cs) => {
          byCourse.set(cs.course_id, { code: cs.courses?.code ?? "", title: cs.courses?.title ?? cs.courses?.code ?? "Subject", ca: null, exam: null, total: null });
        });
      own.forEach((r) => {
        byCourse.set(r.course_id, {
          code: r.courses?.code ?? "",
          title: r.courses?.title ?? r.courses?.code ?? "Subject",
          ca: Number(r.ca_score ?? 0),
          exam: Number(r.exam_score ?? 0),
          total: effectiveTotal(r),
        });
      });

      sheets.push({
        student: { full_name: student.full_name, admission_number: student.matric_number },
        className,
        sessionName: selectedSession?.name ?? "",
        term,
        subjects: orderSubjects(Array.from(byCourse.values())),
        position: rank > 0 ? rank : null,
        classSize: roster.length || null,
        comments: {
          classTeacher: comment?.class_teacher_comment ?? autoClassTeacherRemark,
          headTeacher: comment?.head_teacher_comment ?? null,
        },
        header: { authorityLine: rs.authority_line, schoolLine: rs.school_line },
        nextTermBegins: nextTermBegins || rs.next_term_begins || null,
        gradingScale: settings.grading_scale,
      });
    }
    return { sheets, skipped };
  };

  const handleGenerate = async (studentId: string) => {
    if (!sessionId) { toast.error("Select a session first"); return; }
    setGeneratingId(studentId);
    try {
      const { sheets } = await buildSheets([studentId]);
      if (sheets.length === 0) {
        toast.error("No published results for this pupil in the selected session and term. Approve and publish the results first.");
        return;
      }
      generateReportSheetPdf(sheets[0]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate report sheet");
    } finally {
      setGeneratingId(null);
    }
  };

  /** One PDF, one page per selected pupil, in the order they're listed. */
  const handleGenerateSelected = async () => {
    if (!sessionId) { toast.error("Select a session first"); return; }
    if (selectedInRoster.length === 0) { toast.error("Tick at least one pupil first"); return; }
    setBulkBusy(true);
    setBulkProgress(null);
    try {
      const { sheets, skipped } = await buildSheets(selectedInRoster.map((s) => s.id));
      if (sheets.length === 0) {
        toast.error("None of the selected pupils have published results for this session and term. Approve and publish the results first.");
        return;
      }
      let doc: ReturnType<typeof generateReportSheetPdf> | undefined;
      for (let i = 0; i < sheets.length; i++) {
        setBulkProgress({ done: i, total: sheets.length });
        // Let the progress text paint between pupils — drawing each page is synchronous.
        await new Promise((resolve) => setTimeout(resolve, 0));
        doc = generateReportSheetPdf(sheets[i], doc ? { doc, save: false } : { save: false });
      }
      const safe = (v: string) => v.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
      doc!.save(`report_sheets_${safe(className) || "class"}_${safe(selectedSession?.name ?? "")}_${term}.pdf`);
      toast.success(`${sheets.length} report sheet${sheets.length === 1 ? "" : "s"} downloaded as one PDF`);
      if (skipped.length > 0) {
        toast.warning(`${skipped.length} pupil${skipped.length === 1 ? "" : "s"} skipped — no published results: ${skipped.join(", ")}`, { duration: 12000 });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate report sheets");
    } finally {
      setBulkBusy(false);
      setBulkProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Report Sheets</h2>
        <p className="text-sm text-muted-foreground">Pick a class, session and term, then download a pupil's terminal report sheet — or tick several pupils (or the whole class) and download all their sheets at once as a single PDF, one page per pupil.</p>
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <div><Label>Class</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setClassArmId(""); setSelectedIds(new Set()); }}>
              <option value="">Select</option>{departmentsQ.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div><Label>Arm (optional)</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={classArmId} onChange={(e) => { setClassArmId(e.target.value); setSelectedIds(new Set()); }} disabled={!departmentId}>
              <option value="">Whole class</option>{armsForClass.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div><Label>Session</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              <option value="">Select</option>{sessionsQ.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><Label>Term</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={term} onChange={(e) => setTerm(e.target.value)}>
              <option value="First">First</option><option value="Second">Second</option><option value="Third">Third</option>
            </select>
          </div>
          <div><Label>Next term begins</Label>
            <Input type="date" value={nextTermBegins} onChange={(e) => setNextTermBegins(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Pupils {className && `— ${className}`}</CardTitle>
          {roster.length > 0 && (
            <Button size="sm" disabled={bulkBusy || selectedInRoster.length === 0} onClick={handleGenerateSelected}>
              {bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Files className="mr-2 h-4 w-4" />}
              {bulkBusy && bulkProgress
                ? `Preparing ${bulkProgress.done + 1} of ${bulkProgress.total}…`
                : bulkBusy
                  ? "Preparing…"
                  : `Download selected${selectedInRoster.length > 0 ? ` (${selectedInRoster.length})` : ""}`}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {roster.length > 0 && (
            <label className="flex cursor-pointer items-center gap-3 rounded-md bg-secondary/50 p-3 text-sm font-medium">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} disabled={bulkBusy} aria-label="Select all pupils" />
              Select all ({roster.length})
              {selectedInRoster.length > 0 && !allSelected && <span className="font-normal text-muted-foreground">· {selectedInRoster.length} selected</span>}
            </label>
          )}
          {roster.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleOne(s.id)} disabled={bulkBusy} aria-label={`Select ${s.full_name}`} />
                <span className="truncate text-sm font-medium">{s.full_name}</span>
              </label>
              <Button size="sm" variant="outline" disabled={generatingId === s.id || bulkBusy} onClick={() => handleGenerate(s.id)}>
                {generatingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Download className="mr-2 h-4 w-4" /> Report sheet</>}
              </Button>
            </div>
          ))}
          {departmentId && studentsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No pupils found for this selection.</p>}
          {!departmentId && <p className="text-sm text-muted-foreground">Select a class to list its pupils.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
