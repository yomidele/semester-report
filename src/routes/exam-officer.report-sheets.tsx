import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedExamOfficer } from "@/components/ProtectedExamOfficer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { useCollegeSettings } from "@/lib/college-settings";
import { generateReportSheetPdf } from "@/lib/report-sheet";

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
      let q = supabase.from("students").select("id, full_name, matric_number, class_arm_id").eq("department_id", departmentId);
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
      const [{ data: student }, { data: results }, { data: comments }, { data: attendance }] = await Promise.all([
        supabase.from("students").select("full_name, matric_number").eq("id", studentId).maybeSingle(),
        supabase.from("results").select("ca_score, exam_score, total_score, course_id, courses:course_id(code, title)").eq("student_id", studentId).eq("session_id", sessionId).eq("semester", term),
        supabase.from("report_card_comments").select("class_teacher_comment, head_teacher_comment, conduct_rating").eq("student_id", studentId).eq("session_id", sessionId).eq("term", term).maybeSingle(),
        supabase.from("attendance").select("status").eq("student_id", studentId).eq("session_id", sessionId).eq("term", term),
      ]);
      if (!student) { toast.error("Pupil not found"); return; }

      // Class averages per subject, across the same arm/class + session + term.
      const classmateIds = (studentsQ.data ?? []).map((s) => s.id);
      const { data: classResults } = await supabase
        .from("results")
        .select("course_id, ca_score, exam_score, total_score, student_id")
        .in("student_id", classmateIds.length ? classmateIds : [studentId])
        .eq("session_id", sessionId)
        .eq("semester", term);

      const totalsByStudent = new Map<string, number[]>();
      (classResults ?? []).forEach((r) => {
        const total = r.total_score != null ? Number(r.total_score) : Number(r.ca_score ?? 0) + Number(r.exam_score ?? 0);
        const arr = totalsByStudent.get(r.student_id) ?? [];
        arr.push(total);
        totalsByStudent.set(r.student_id, arr);
      });
      const averages = Array.from(totalsByStudent.entries()).map(([id, totals]) => ({
        id,
        avg: totals.reduce((a, b) => a + b, 0) / (totals.length || 1),
      })).sort((a, b) => b.avg - a.avg);
      const rank = averages.findIndex((a) => a.id === studentId) + 1;

      const subjectAverages = new Map<string, { sum: number; count: number }>();
      (classResults ?? []).forEach((r) => {
        const total = r.total_score != null ? Number(r.total_score) : Number(r.ca_score ?? 0) + Number(r.exam_score ?? 0);
        const cur = subjectAverages.get(r.course_id) ?? { sum: 0, count: 0 };
        cur.sum += total; cur.count += 1;
        subjectAverages.set(r.course_id, cur);
      });

      const subjects = (results ?? []).map((r: any) => {
        const total = r.total_score != null ? Number(r.total_score) : Number(r.ca_score ?? 0) + Number(r.exam_score ?? 0);
        const subjAvg = subjectAverages.get(r.course_id);
        return {
          code: r.courses?.code ?? "",
          title: r.courses?.title ?? r.courses?.code ?? "Subject",
          ca: Number(r.ca_score ?? 0),
          exam: Number(r.exam_score ?? 0),
          total,
          classAverage: subjAvg ? subjAvg.sum / subjAvg.count : null,
        };
      });

      const presentCount = (attendance ?? []).filter((a) => a.status === "present" || a.status === "late").length;
      const absentCount = (attendance ?? []).filter((a) => a.status === "absent").length;

      generateReportSheetPdf({
        student: { full_name: student.full_name, admission_number: student.matric_number },
        className,
        sessionName: selectedSession?.name ?? "",
        term,
        subjects,
        position: averages.length ? { rank, outOf: averages.length } : null,
        attendance: attendance && attendance.length ? { present: presentCount, absent: absentCount, total: attendance.length } : null,
        comments: {
          classTeacher: comments?.class_teacher_comment ?? null,
          headTeacher: comments?.head_teacher_comment ?? null,
          conduct: comments?.conduct_rating ?? null,
        },
        school: {
          name: settings.college_name,
          address: settings.address ?? undefined,
          city: settings.city ?? undefined,
          state: settings.state ?? undefined,
          motto: settings.motto ?? undefined,
          logo_url: settings.logo_url,
        },
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
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
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
