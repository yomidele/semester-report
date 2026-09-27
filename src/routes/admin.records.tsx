import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollegeSettings } from "@/lib/college-settings";
import { computeGrade, effectiveTotal } from "@/lib/grading";
import { generateAdmissionLetterPdf } from "@/lib/admission-letter";
import { FileDown, Download, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/admin/records")({
  head: () => ({ meta: [{ title: "Student Records — Admin" }] }),
  component: () => (
    <ProtectedAdmin>
      <RecordsPage />
    </ProtectedAdmin>
  ),
});

const TERM_ORDER: Record<string, number> = { First: 1, Second: 2, Third: 3 };

type StudentListRow = {
  id: string;
  full_name: string;
  matric_number: string;
  status: string;
};

type StudentDetail = {
  id: string;
  full_name: string;
  matric_number: string;
  email: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  status: string;
  status_reason: string | null;
  status_date: string | null;
  admission_date: string;
  class_arm_id: string | null;
};

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

interface AttendanceRow {
  session_id: string;
  term: string;
  status: string;
  academic_sessions: { name: string } | null;
}

interface CommentRow {
  session_id: string;
  term: string;
  class_teacher_comment: string | null;
  head_teacher_comment: string | null;
  conduct_rating: string | null;
  attendance_summary: string | null;
  academic_sessions: { name: string } | null;
}

interface ClassHistoryRow {
  id: string;
  session_id: string;
  from_department_id: string | null;
  to_department_id: string | null;
  outcome: string;
  created_at: string;
  academic_sessions: { name: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  withdrawn: "Withdrawn",
  transferred: "Transferred",
  graduated: "Graduated",
};

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  withdrawn: "destructive",
  transferred: "outline",
  graduated: "secondary",
};

const OUTCOME_LABEL: Record<string, string> = {
  promoted: "Promoted",
  repeated: "Repeated",
  completed_final_class: "Completed final class",
};

function RecordsPage() {
  const { settings } = useCollegeSettings();
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState<string | undefined>();

  const { data: students = [] } = useQuery({
    queryKey: ["records-students-list"],
    queryFn: async () =>
      ((await supabase.from("students").select("id, full_name, matric_number, status").order("full_name")).data ??
        []) as StudentListRow[],
  });

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students.slice(0, 20);
    return students
      .filter((s) => s.full_name.toLowerCase().includes(q) || s.matric_number.toLowerCase().includes(q))
      .slice(0, 20);
  }, [students, search]);

  const { data: student } = useQuery({
    queryKey: ["records-student-detail", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select(
          "id, full_name, matric_number, email, gender, date_of_birth, address, guardian_name, guardian_phone, status, status_reason, status_date, admission_date, class_arm_id",
        )
        .eq("id", studentId!)
        .maybeSingle();
      if (error) throw error;
      return data as StudentDetail | null;
    },
  });

  const { data: classArm } = useQuery({
    queryKey: ["records-class-arm", student?.class_arm_id],
    enabled: !!student?.class_arm_id,
    queryFn: async () =>
      (
        await supabase
          .from("class_arms")
          .select("name, departments:department_id(name, faculties:faculty_id(name))")
          .eq("id", student!.class_arm_id!)
          .maybeSingle()
      ).data,
  });
  const departmentInfo = classArm?.departments as unknown as { name?: string; faculties?: { name?: string } | null } | null;
  const departmentName = departmentInfo?.name ?? "";
  const facultyName = departmentInfo?.faculties?.name ?? "";
  const classLabel = classArm ? `${departmentName} ${classArm.name}`.trim() : "—";

  const { data: allResults = [] } = useQuery<ResultRow[]>({
    queryKey: ["records-results", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("results")
        .select("id, semester, ca_score, exam_score, total_score, session_id, courses(code, title), academic_sessions(name)")
        .eq("student_id", studentId!);
      if (error) throw error;
      return (data ?? []) as unknown as ResultRow[];
    },
  });

  const { data: attendance = [] } = useQuery<AttendanceRow[]>({
    queryKey: ["records-attendance", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("session_id, term, status, academic_sessions(name)")
        .eq("student_id", studentId!);
      if (error) throw error;
      return (data ?? []) as unknown as AttendanceRow[];
    },
  });

  const { data: comments = [] } = useQuery<CommentRow[]>({
    queryKey: ["records-comments", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_card_comments")
        .select("session_id, term, class_teacher_comment, head_teacher_comment, conduct_rating, attendance_summary, academic_sessions(name)")
        .eq("student_id", studentId!);
      if (error) throw error;
      return (data ?? []) as unknown as CommentRow[];
    },
  });

  const { data: classHistory = [] } = useQuery<ClassHistoryRow[]>({
    queryKey: ["records-class-history", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_class_history")
        .select("id, session_id, from_department_id, to_department_id, outcome, created_at, academic_sessions(name)")
        .eq("student_id", studentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClassHistoryRow[];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["records-departments-all"],
    queryFn: async () => (await supabase.from("departments").select("id, name")).data ?? [],
  });
  const departmentNameById = useMemo(() => {
    const m = new Map<string, string>();
    departments.forEach((d) => m.set(d.id, d.name));
    return m;
  }, [departments]);

  // Group results by Session + Term, same convention used across the portal
  // (a pupil's results are recorded per term, not per "level").
  const groups = useMemo(() => {
    const m = new Map<string, { sessionName: string; semester: string; rows: ResultRow[] }>();
    for (const r of allResults) {
      const sn = r.academic_sessions?.name ?? "—";
      const k = `${sn}__${r.semester}`;
      if (!m.has(k)) m.set(k, { sessionName: sn, semester: r.semester, rows: [] });
      m.get(k)!.rows.push(r);
    }
    return Array.from(m.values()).sort((a, b) => {
      if (a.sessionName !== b.sessionName) return a.sessionName.localeCompare(b.sessionName);
      return (TERM_ORDER[a.semester] ?? 0) - (TERM_ORDER[b.semester] ?? 0);
    });
  }, [allResults]);

  const averageOf = (rows: ResultRow[]) => {
    if (rows.length === 0) return 0;
    return rows.reduce((s, r) => s + effectiveTotal(r), 0) / rows.length;
  };

  // Attendance summary grouped the same way as results, so the two line up
  // term-for-term on screen.
  const attendanceGroups = useMemo(() => {
    const m = new Map<string, { sessionName: string; term: string; present: number; absent: number; late: number; excused: number; total: number }>();
    for (const a of attendance) {
      const sn = a.academic_sessions?.name ?? "—";
      const k = `${sn}__${a.term}`;
      if (!m.has(k)) m.set(k, { sessionName: sn, term: a.term, present: 0, absent: 0, late: 0, excused: 0, total: 0 });
      const g = m.get(k)!;
      g.total += 1;
      if (a.status === "present") g.present += 1;
      else if (a.status === "absent") g.absent += 1;
      else if (a.status === "late") g.late += 1;
      else if (a.status === "excused") g.excused += 1;
    }
    return Array.from(m.values()).sort((a, b) => {
      if (a.sessionName !== b.sessionName) return a.sessionName.localeCompare(b.sessionName);
      return (TERM_ORDER[a.term] ?? 0) - (TERM_ORDER[b.term] ?? 0);
    });
  }, [attendance]);

  const downloadReportCard = (rowGroups: typeof groups, fileLabel: string) => {
    if (!student || rowGroups.length === 0) {
      toast.error("No results to include in this report card");
      return;
    }
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 40;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(settings.college_name.toUpperCase(), pageW / 2, y, { align: "center" });
    y += 18;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Report Card", pageW / 2, y, { align: "center" });
    y += 22;

    doc.setFontSize(10);
    doc.text(`Pupil: ${student.full_name}`, 40, y);
    doc.text(`Admission Number: ${student.matric_number}`, pageW - 40, y, { align: "right" });
    y += 14;
    doc.text(`Class: ${classLabel}`, 40, y);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageW - 40, y, { align: "right" });
    y += 18;

    for (const g of rowGroups) {
      const avg = averageOf(g.rows);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${g.sessionName}  \u00b7  ${g.semester} Term`, 40, y);
      y += 4;

      autoTable(doc, {
        startY: y + 4,
        head: [["Code", "Subject", "CA", "Exam", "Total", "Grade"]],
        body: g.rows
          .sort((a, b) => (a.courses?.code ?? "").localeCompare(b.courses?.code ?? ""))
          .map((r) => {
            const total = effectiveTotal(r);
            const gr = computeGrade(total);
            return [
              r.courses?.code ?? "",
              r.courses?.title ?? "",
              String(Number(r.ca_score)),
              String(Number(r.exam_score)),
              String(total),
              gr.grade,
            ];
          }),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [5, 87, 56] },
        margin: { left: 40, right: 40 },
      });
      // @ts-expect-error lastAutoTable injected by autotable
      y = doc.lastAutoTable.finalY + 6;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text(`Term Average: ${avg.toFixed(1)}%   \u00b7   Subjects: ${g.rows.length}`, pageW - 40, y, { align: "right" });
      y += 18;
      if (y > doc.internal.pageSize.getHeight() - 80) {
        doc.addPage();
        y = 40;
      }
    }

    if (rowGroups.length > 1) {
      const overallAverage = averageOf(rowGroups.flatMap((g) => g.rows));
      if (y > doc.internal.pageSize.getHeight() - 80) {
        doc.addPage();
        y = 40;
      }
      doc.setDrawColor(180);
      doc.line(40, y, pageW - 40, y);
      y += 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`Overall Average: ${overallAverage.toFixed(1)}%`, 40, y);
      doc.text(`Terms Covered: ${rowGroups.length}`, pageW - 40, y, { align: "right" });
    }

    doc.save(`report-card_${student.matric_number.replace(/[\/\\]/g, "_")}_${fileLabel}.pdf`);
    toast.success("Report Card downloaded");
  };

  const downloadAdmissionLetter = () => {
    if (!student) return;
    generateAdmissionLetterPdf({
      admission_number: student.matric_number,
      full_name: student.full_name,
      admission_date: student.admission_date,
      class_name: classLabel !== "—" ? classLabel : "the assigned class",
      school: {
        name: settings.college_name,
        short_name: settings.short_name,
        address: settings.address ?? "",
        city: settings.city ?? "",
        state: settings.state ?? "",
        motto: settings.motto ?? "",
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Student Records</h2>
        <p className="text-sm text-muted-foreground">
          Search for any pupil — past or present — to see their full record and download report cards from any past term.
        </p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="text-base">Find a Pupil</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Search by name or admission number</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. Sadiq or PR/26/0091" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Pupil</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder={`${filteredStudents.length} match(es)`} />
              </SelectTrigger>
              <SelectContent>
                {filteredStudents.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.matric_number} — {s.full_name}
                    {s.status !== "active" ? ` (${STATUS_LABEL[s.status] ?? s.status})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!student && (
        <Card className="tsu-shadow">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <UserRound className="h-8 w-8" />
            <p className="text-sm">Search for a pupil above to view their record.</p>
          </CardContent>
        </Card>
      )}

      {student && (
        <>
          <Card className="tsu-shadow">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">{student.full_name}</p>
                  <Badge variant={STATUS_BADGE_VARIANT[student.status] ?? "outline"}>
                    {STATUS_LABEL[student.status] ?? student.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Admission No: {student.matric_number} · Class: {classLabel}
                  {facultyName ? ` · ${facultyName}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={downloadAdmissionLetter}>
                  <Download className="mr-2 h-4 w-4" /> Admission Letter
                </Button>
                <Button size="sm" onClick={() => downloadReportCard(groups, "full_record")} disabled={groups.length === 0}>
                  <FileDown className="mr-2 h-4 w-4" /> Full Report Card
                </Button>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="profile">
            <TabsList>
              <TabsTrigger value="profile">Profile &amp; Admission</TabsTrigger>
              <TabsTrigger value="results">Report Cards ({groups.length})</TabsTrigger>
              <TabsTrigger value="attendance">Attendance &amp; Comments</TabsTrigger>
              <TabsTrigger value="history">Class History ({classHistory.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card className="tsu-shadow">
                <CardHeader>
                  <CardTitle className="text-base">Personal &amp; Admission Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-2">
                  <Field label="Full name" value={student.full_name} />
                  <Field label="Admission number" value={student.matric_number} />
                  <Field label="Admission date" value={new Date(student.admission_date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })} />
                  <Field label="Current class" value={classLabel} />
                  <Field label="Gender" value={student.gender ?? "—"} />
                  <Field label="Date of birth" value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "—"} />
                  <Field label="Email" value={student.email ?? "—"} />
                  <Field label="Home address" value={student.address ?? "—"} />
                  <Field label="Guardian name" value={student.guardian_name ?? "—"} />
                  <Field label="Guardian phone" value={student.guardian_phone ?? "—"} />
                  {student.status !== "active" && (
                    <>
                      <Field label="Status reason" value={student.status_reason ?? "—"} />
                      <Field label="Status date" value={student.status_date ? new Date(student.status_date).toLocaleDateString() : "—"} />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              {groups.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No results on record for this pupil yet.</p>
              )}
              {groups.map((g, i) => {
                const avg = averageOf(g.rows);
                return (
                  <Card key={i} className="tsu-shadow">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {g.sessionName} · {g.semester} Term
                        </CardTitle>
                        <CardDescription>
                          {g.rows.length} subject(s) · Average {avg.toFixed(1)}%
                        </CardDescription>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => downloadReportCard([g], `${g.sessionName}_${g.semester}`)}>
                        <FileDown className="mr-2 h-4 w-4" /> Download
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>CA</TableHead>
                            <TableHead>Exam</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Grade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {g.rows
                            .sort((a, b) => (a.courses?.code ?? "").localeCompare(b.courses?.code ?? ""))
                            .map((r) => {
                              const total = effectiveTotal(r);
                              const gr = computeGrade(total);
                              return (
                                <TableRow key={r.id}>
                                  <TableCell>{r.courses?.code ?? ""}</TableCell>
                                  <TableCell>{r.courses?.title ?? ""}</TableCell>
                                  <TableCell>{Number(r.ca_score)}</TableCell>
                                  <TableCell>{Number(r.exam_score)}</TableCell>
                                  <TableCell>{total}</TableCell>
                                  <TableCell>{gr.grade}</TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="attendance" className="space-y-4">
              <Card className="tsu-shadow">
                <CardHeader>
                  <CardTitle className="text-base">Attendance Summary</CardTitle>
                  <CardDescription>Per term, from daily attendance marks.</CardDescription>
                </CardHeader>
                <CardContent>
                  {attendanceGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No attendance recorded for this pupil yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Session</TableHead>
                          <TableHead>Term</TableHead>
                          <TableHead>Present</TableHead>
                          <TableHead>Absent</TableHead>
                          <TableHead>Late</TableHead>
                          <TableHead>Excused</TableHead>
                          <TableHead>Total Days</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendanceGroups.map((g, i) => (
                          <TableRow key={i}>
                            <TableCell>{g.sessionName}</TableCell>
                            <TableCell>{g.term}</TableCell>
                            <TableCell>{g.present}</TableCell>
                            <TableCell>{g.absent}</TableCell>
                            <TableCell>{g.late}</TableCell>
                            <TableCell>{g.excused}</TableCell>
                            <TableCell>{g.total}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card className="tsu-shadow">
                <CardHeader>
                  <CardTitle className="text-base">Teacher &amp; Head Teacher Comments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {comments.length === 0 && <p className="text-sm text-muted-foreground">No report card comments on record yet.</p>}
                  {comments.map((c, i) => (
                    <div key={i} className="space-y-1 rounded-md border border-border p-3 text-sm">
                      <p className="font-medium">
                        {c.academic_sessions?.name ?? "—"} · {c.term} Term
                        {c.conduct_rating ? ` · Conduct: ${c.conduct_rating}` : ""}
                      </p>
                      {c.class_teacher_comment && <p className="text-muted-foreground">Class teacher: {c.class_teacher_comment}</p>}
                      {c.head_teacher_comment && <p className="text-muted-foreground">Head teacher: {c.head_teacher_comment}</p>}
                      {c.attendance_summary && <p className="text-muted-foreground">Attendance: {c.attendance_summary}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card className="tsu-shadow">
                <CardHeader>
                  <CardTitle className="text-base">Class History</CardTitle>
                  <CardDescription>Promotions, repeats, and transfers, most recent first.</CardDescription>
                </CardHeader>
                <CardContent>
                  {classHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No class history recorded yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Session</TableHead>
                          <TableHead>From</TableHead>
                          <TableHead>To</TableHead>
                          <TableHead>Outcome</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classHistory.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell>{h.academic_sessions?.name ?? "—"}</TableCell>
                            <TableCell>{h.from_department_id ? departmentNameById.get(h.from_department_id) ?? "—" : "—"}</TableCell>
                            <TableCell>{h.to_department_id ? departmentNameById.get(h.to_department_id) ?? "—" : "Completed"}</TableCell>
                            <TableCell>{OUTCOME_LABEL[h.outcome] ?? h.outcome}</TableCell>
                            <TableCell>{new Date(h.created_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p>{value}</p>
    </div>
  );
}
