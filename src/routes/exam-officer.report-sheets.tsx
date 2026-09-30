import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedExamOfficer } from "@/components/ProtectedExamOfficer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { useCollegeSettings } from "@/lib/college-settings";
import { generateReportSheetPdf, orderSubjects } from "@/lib/report-sheet";
import { effectiveTotal, rankByAverage, autoRemark } from "@/lib/grading";

export const Route = createFileRoute("/exam-officer/report-sheets")({
  head: () => ({ meta: [{ title: "Report Sheets — Exam Officer" }] }),
  component: () => <ProtectedExamOfficer><Page /></ProtectedExamOfficer>,
});

function Page() {
  const { settings } = useCollegeSettings();
  const [departmentId, setDepartmentId] = useState("");
  const [classArmId, setClassArmId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [term, setTerm] = useState("First");
  const [nextTermBegins, setNextTermBegins] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);

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

  const handleGenerate = async (studentId: string) => {
    if (!sessionId) { toast.error("Select a session first"); return; }
    setGeneratingId(studentId);
    try {
      const [{ data: student }, { data: results }, { data: comments }] = await Promise.all([
        supabase.from("students").select("full_name, matric_number, class_arm_id").eq("id", studentId).maybeSingle(),
        supabase.from("results").select("ca_score, exam_score, total_score, course_id, courses:course_id(code, title)").eq("student_id", studentId).eq("session_id", sessionId).eq("semester", term).eq("status", "published"),
        supabase.from("report_card_comments").select("class_teacher_comment, head_teacher_comment, conduct_rating").eq("student_id", studentId).eq("session_id", sessionId).eq("term", term).maybeSingle(),
      ]);
      if (!student) { toast.error("Pupil not found"); return; }
      if (!results || results.length === 0) {
        toast.error("No published results for this pupil in the selected session and term. Approve and publish the results first.");
        return;
      }

      // Class averages per subject, across the same arm/class + session + term.
      const classmateIds = (studentsQ.data ?? []).map((s) => s.id);
      const { data: classResults } = await supabase
        .from("results")
        .select("course_id, ca_score, exam_score, total_score, student_id")
        .in("student_id", classmateIds.includes(studentId) ? classmateIds : [...classmateIds, studentId])
        .eq("session_id", sessionId)
        .eq("semester", term)
        .eq("status", "published");

      const totalsByStudent = new Map<string, number[]>();
      (classResults ?? []).forEach((r) => {
        const total = effectiveTotal(r);
        const arr = totalsByStudent.get(r.student_id) ?? [];
        arr.push(total);
        totalsByStudent.set(r.student_id, arr);
      });
      const averages = Array.from(totalsByStudent.entries()).map(([id, totals]) => ({
        id,
        avg: totals.reduce((a, b) => a + b, 0) / (totals.length || 1),
      })).sort((a, b) => b.avg - a.avg);
      const rank = rankByAverage(averages.map((a) => ({ id: a.id, average: a.avg }))).get(studentId) ?? 0;
      const pupilAverage = averages.find((a) => a.id === studentId)?.avg ?? 0;
      const firstName = student.full_name.trim().split(/\s+/)[0];
      // A remark the class teacher actually typed always wins; otherwise the
      // sheet still leaves the school's own remark section filled in rather
      // than blank, generated from this term's actual average.
      const autoClassTeacherRemark = autoRemark(pupilAverage, settings.grading_scale, firstName);

      // Rows = every subject taught to this pupil's class arm (blank when no
      // published score yet, like the printed sheet) plus any scored subject.
      const byCourse = new Map<string, { code: string; title: string; ca: number | null; exam: number | null; total: number | null }>();
      if (student.class_arm_id) {
        const { data: classSubjects } = await supabase
          .from("class_subjects")
          .select("course_id, courses:course_id(code, title)")
          .eq("class_arm_id", student.class_arm_id);
        (classSubjects ?? []).forEach((cs: any) => {
          byCourse.set(cs.course_id, { code: cs.courses?.code ?? "", title: cs.courses?.title ?? cs.courses?.code ?? "Subject", ca: null, exam: null, total: null });
        });
      }
      (results ?? []).forEach((r: any) => {
        byCourse.set(r.course_id, {
          code: r.courses?.code ?? "",
          title: r.courses?.title ?? r.courses?.code ?? "Subject",
          ca: Number(r.ca_score ?? 0),
          exam: Number(r.exam_score ?? 0),
          total: effectiveTotal(r),
        });
      });
      const subjects = orderSubjects(Array.from(byCourse.values()));

      const rs = ((settings as unknown as { report_card_settings?: Record<string, string> | null }).report_card_settings ?? {}) as Record<string, string>;

      generateReportSheetPdf({
        student: { full_name: student.full_name, admission_number: student.matric_number },
        className,
        sessionName: selectedSession?.name ?? "",
        term,
        subjects,
        position: rank > 0 ? rank : null,
        classSize: (studentsQ.data ?? []).length || null,
        comments: {
          classTeacher: comments?.class_teacher_comment ?? autoClassTeacherRemark,
          headTeacher: comments?.head_teacher_comment ?? null,
        },
        header: { authorityLine: rs.authority_line, schoolLine: rs.school_line },
        nextTermBegins: nextTermBegins || rs.next_term_begins || null,
        gradingScale: settings.grading_scale,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate report sheet");
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Report Sheets</h2>
        <p className="text-sm text-muted-foreground">Pick a class, session and term, then download a pupil's terminal report sheet as a PDF.</p>
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <div><Label>Class</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setClassArmId(""); }}>
              <option value="">Select</option>{departmentsQ.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div><Label>Arm (optional)</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={classArmId} onChange={(e) => setClassArmId(e.target.value)} disabled={!departmentId}>
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
        <CardHeader><CardTitle className="text-base">Pupils {className && `— ${className}`}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(studentsQ.data ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-3">
              <p className="text-sm font-medium">{s.full_name}</p>
              <Button size="sm" variant="outline" disabled={generatingId === s.id} onClick={() => handleGenerate(s.id)}>
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
