import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProtectedTeacher } from "@/components/ProtectedTeacher";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Search as SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { teacherSubmitResults } from "@/lib/result-workflow.functions";
import { RESULT_LIMITS, computeTotal, validateScores } from "@/lib/grading";

const Search = z.object({ assignment_id: z.string().uuid().optional() });

export const Route = createFileRoute("/lecturer/entry")({
  head: () => ({ meta: [{ title: "Grade Entry — Teacher" }] }),
  validateSearch: (s) => Search.parse(s),
  component: () => <ProtectedTeacher><Page /></ProtectedTeacher>,
});

// Auto-save-to-draft: as a teacher types scores here, they're mirrored into
// localStorage keyed to this exact assignment. If the teacher navigates back
// to the dashboard (or loses connection, closes the tab, etc.) without
// clicking "Save draft", nothing typed is lost — reopening this same
// assignment restores it. This is distinct from the "Save draft" button,
// which writes a real draft-status row to the database; this local copy is
// only a safety net for what hasn't been sent to the server yet, and is
// cleared the moment "Save draft" succeeds.
type LocalScores = Record<string, { ca: string; exam: string }>;

function localDraftKey(assignmentId: string | undefined): string | null {
  return assignmentId ? `lecturerEntryDraft:v1:${assignmentId}` : null;
}

function readLocalDraft(key: string): LocalScores | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as LocalScores;
  } catch {
    return null;
  }
}

function Page() {
  const { assignment_id } = Route.useSearch();
  const qc = useQueryClient();
  const submit = useServerFn(teacherSubmitResults);
  const [draft, setDraft] = useState<Record<string, { ca: string; exam: string }>>({});
  const [studentSearch, setStudentSearch] = useState("");
  const [armFilter, setArmFilter] = useState("all");
  const restoredForAssignment = useRef<string | undefined>(undefined);

  // Restore any unsaved scores left behind from a previous visit to this
  // assignment, and reset local state when switching to a different one.
  useEffect(() => {
    if (restoredForAssignment.current === assignment_id) return;
    restoredForAssignment.current = assignment_id;
    setStudentSearch("");
    setArmFilter("all");
    const key = localDraftKey(assignment_id);
    const restored = key ? readLocalDraft(key) : null;
    if (restored && Object.keys(restored).length > 0) {
      setDraft(restored);
      toast.info(`Restored ${Object.keys(restored).length} unsaved score${Object.keys(restored).length !== 1 ? "s" : ""} from where you left off`);
    } else {
      setDraft({});
    }
  }, [assignment_id]);

  // Mirror the in-progress draft into localStorage as it's typed.
  useEffect(() => {
    const key = localDraftKey(assignment_id);
    if (!key) return;
    const nonEmpty = Object.fromEntries(
      Object.entries(draft).filter(([, v]) => v.ca !== "" || v.exam !== "")
    );
    try {
      if (Object.keys(nonEmpty).length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(nonEmpty));
      }
    } catch {
      // localStorage can fail (private browsing, quota) — this is only a
      // convenience safety net, so fail silently rather than interrupt entry.
    }
  }, [draft, assignment_id]);

  const assignmentQ = useQuery({
    queryKey: ["assignment", assignment_id], enabled: !!assignment_id,
    queryFn: async () => (await supabase.from("course_assignments")
      .select("id, lecturer_id, course_id, session_id, semester, department_id, faculty_id, class_arm_id, courses(code, title), academic_sessions(name)")
      .eq("id", assignment_id!).maybeSingle()).data,
  });

  const studentsQ = useQuery({
    queryKey: ["assignment-students", assignmentQ.data?.id], enabled: !!assignmentQ.data,
    queryFn: async () => {
      const a = assignmentQ.data!;
      let query = supabase.from("students")
        .select("id, full_name, matric_number, class_arm_id")
        .eq("department_id", a.department_id)
        .eq("status", "active");
      if (a.class_arm_id) query = query.eq("class_arm_id", a.class_arm_id);
      const { data } = await query.order("full_name");
      return data ?? [];
    },
  });

  // When the teacher takes the whole class (no single arm on the assignment),
  // load the class's arms so the list can be narrowed to one arm at a time.
  const armsQ = useQuery({
    queryKey: ["assignment-arms", assignmentQ.data?.department_id],
    enabled: !!assignmentQ.data && !assignmentQ.data.class_arm_id,
    queryFn: async () => {
      const { data } = await supabase.from("class_arms")
        .select("id, name")
        .eq("department_id", assignmentQ.data!.department_id)
        .order("name");
      return data ?? [];
    },
  });

  const existingQ = useQuery({
    queryKey: ["assignment-results", assignmentQ.data?.id], enabled: !!assignmentQ.data,
    queryFn: async () => {
      const a = assignmentQ.data!;
      const { data } = await supabase.from("results")
        .select("id, student_id, ca_score, exam_score, total_score, status, returned_reason")
        .eq("course_id", a.course_id).eq("session_id", a.session_id).eq("semester", a.semester);
      return data ?? [];
    },
  });

  const byStudent = useMemo(() => {
    const m: Record<string, any> = {};
    (existingQ.data ?? []).forEach((r: any) => { m[r.student_id] = r; });
    return m;
  }, [existingQ.data]);

  // Enter moves to the next score field (CA -> Exam -> next row's CA), same
  // as ResultsEntryGrid, so a teacher can enter a whole class without
  // reaching for the mouse.
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const registerInputRef = (studentId: string, field: "ca" | "exam") => (el: HTMLInputElement | null) => {
    inputRefs.current[`${studentId}-${field}`] = el;
  };
  const students = studentsQ.data ?? [];
  // Search only narrows what's displayed — it never touches typed scores for
  // pupils that are filtered out, and Enter moves through the visible rows.
  const arms = armsQ.data ?? [];
  const showArmFilter = !assignmentQ.data?.class_arm_id && arms.length > 1;
  const armNameById = useMemo(() => Object.fromEntries(arms.map((x: any) => [x.id, x.name])), [arms]);
  // Who a submit covers: every pupil of the chosen arm (or the whole assignment
  // when no arm is chosen). Deliberately ignores the text search so typing in
  // the search box never changes what gets sent for review.
  const scopedStudentIds = useMemo(
    () => new Set(
      students
        .filter((s: any) => !showArmFilter || armFilter === "all" || s.class_arm_id === armFilter)
        .map((s: any) => s.id as string),
    ),
    [students, armFilter, showArmFilter],
  );
  const scopeLabel = showArmFilter && armFilter !== "all" ? (armNameById[armFilter] ?? "this arm") : null;
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students.filter((s: any) => {
      if (showArmFilter && armFilter !== "all" && s.class_arm_id !== armFilter) return false;
      if (!q) return true;
      return s.full_name.toLowerCase().includes(q) || String(s.matric_number ?? "").toLowerCase().includes(q);
    });
  }, [students, studentSearch, armFilter, showArmFilter]);
  const handleScoreKeyDown = (studentId: string, field: "ca" | "exam") => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const idx = filteredStudents.findIndex((s) => s.id === studentId);
    if (idx === -1) return;
    let nextKey: string | null = null;
    if (field === "ca") {
      nextKey = `${studentId}-exam`;
    } else if (idx < filteredStudents.length - 1) {
      nextKey = `${filteredStudents[idx + 1].id}-ca`;
    }
    if (nextKey && inputRefs.current[nextKey]) {
      inputRefs.current[nextKey]!.focus();
      inputRefs.current[nextKey]!.select();
    } else {
      (e.target as HTMLInputElement).blur();
    }
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const a = assignmentQ.data!;
      const rows = Object.entries(draft)
        .filter(([_, v]) => v.ca !== "" || v.exam !== "")
        .map(([student_id, v]) => {
          const ca = v.ca !== "" ? Number(v.ca) : null;
          const exam = v.exam !== "" ? Number(v.exam) : null;
          // Blank is not zero: a missing score must never be silently saved as 0.
          const problem = validateScores(ca, exam);
          if (problem) {
            const name = students.find((s) => s.id === student_id)?.full_name ?? "a pupil";
            throw new Error(`${name}: ${problem}`);
          }
          return {
            student_id,
            course_id: a.course_id,
            session_id: a.session_id,
            semester: a.semester,
            ca_score: ca as number,
            exam_score: exam as number,
            status: "draft",
            faculty_id: a.faculty_id,
            department_id: a.department_id,
          };
        });
      if (!rows.length) throw new Error("Enter at least one score");
      const { error } = await supabase.from("results").upsert(rows as never, { onConflict: "student_id,course_id,session_id,semester" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved as draft");
      setDraft({});
      const key = localDraftKey(assignment_id);
      if (key) {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
      }
      qc.invalidateQueries({ queryKey: ["assignment-results"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      // Only this assignment's pupils, and only the chosen arm when one is
      // selected — so a teacher can send one arm for review while still
      // working on the others.
      const ids = (existingQ.data ?? [])
        .filter((r: any) => r.status === "draft" && scopedStudentIds.has(r.student_id))
        .map((r: any) => r.id);
      if (!ids.length) {
        throw new Error(scopeLabel ? `No saved draft scores for ${scopeLabel}. Save them first.` : "No draft results to submit. Save first.");
      }
      await submit({ data: { result_ids: ids } });
      return ids.length;
    },
    onSuccess: (count: number) => {
      toast.success(`Submitted ${count} result${count !== 1 ? "s" : ""}${scopeLabel ? ` for ${scopeLabel}` : ""} to the Exam Officer for review`);
      qc.invalidateQueries({ queryKey: ["assignment-results"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!assignment_id) return <p className="text-sm text-muted-foreground">Pick a subject from your dashboard.</p>;
  if (!assignmentQ.data) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  const a = assignmentQ.data;
  const subject = a.courses as any;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">{subject?.code} — {subject?.title}</h2>
        <p className="text-sm text-muted-foreground">{a.semester} Term · {(a.academic_sessions as any)?.name}</p>
      </div>
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Enter scores</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save draft</Button>
              <Button size="sm" variant="secondary" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>{scopeLabel ? `Submit ${scopeLabel} for approval` : "Submit for approval"}</Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {showArmFilter && (
              <Select value={armFilter} onValueChange={setArmFilter}>
                <SelectTrigger className="h-9 sm:w-44"><SelectValue placeholder="Class arm" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All arms</SelectItem>
                  {arms.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="relative sm:w-64">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by name or reg. number..."
                className="h-9 pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Pupil</th>{showArmFilter && <th className="py-2 pr-3">Arm</th>}<th className="py-2 pr-3">Reg. No.</th><th className="py-2 pr-3 w-24">CA</th><th className="py-2 pr-3 w-24">Exam</th><th className="py-2 pr-3">Total</th><th className="py-2 pr-3">Status</th></tr></thead>
            <tbody>
              {filteredStudents.length === 0 && students.length > 0 && (
                <tr><td colSpan={showArmFilter ? 7 : 6} className="py-4 text-center text-muted-foreground">No pupils match your filters</td></tr>
              )}
              {filteredStudents.map((s) => {
                const existing = byStudent[s.id];
                const d = draft[s.id] ?? { ca: existing?.ca_score?.toString() ?? "", exam: existing?.exam_score?.toString() ?? "" };
                const total = d.ca !== "" && d.exam !== "" ? computeTotal(d.ca, d.exam) : (existing?.total_score ?? "—");
                const locked = existing && existing.status !== "draft";
                return (
                  <tr key={s.id} className="border-b">
                    <td className="py-2 pr-3">{s.full_name}</td>
                    {showArmFilter && <td className="py-2 pr-3 text-xs text-muted-foreground">{armNameById[(s as any).class_arm_id] ?? "—"}</td>}
                    <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{(s as any).matric_number ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <Input
                        ref={registerInputRef(s.id, "ca")}
                        type="number"
                        min={0}
                        max={RESULT_LIMITS.ca}
                        disabled={locked}
                        value={d.ca}
                        onChange={(e) => setDraft((p) => ({ ...p, [s.id]: { ca: e.target.value, exam: d.exam } }))}
                        onKeyDown={handleScoreKeyDown(s.id, "ca")}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        ref={registerInputRef(s.id, "exam")}
                        type="number"
                        min={0}
                        max={RESULT_LIMITS.exam}
                        disabled={locked}
                        value={d.exam}
                        onChange={(e) => setDraft((p) => ({ ...p, [s.id]: { ca: d.ca, exam: e.target.value } }))}
                        onKeyDown={handleScoreKeyDown(s.id, "exam")}
                      />
                    </td>
                    <td className="py-2 pr-3 font-medium">{total}</td>
                    <td className="py-2 pr-3 text-xs">
                      <span className="uppercase">{existing?.status ?? "—"}</span>
                      {existing?.status === "draft" && (existing as any)?.returned_reason && (
                        <span className="mt-1 block max-w-[220px] rounded bg-destructive/10 p-1 text-[11px] normal-case text-destructive">Returned: {(existing as any).returned_reason}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && <tr><td colSpan={showArmFilter ? 7 : 6} className="py-4 text-center text-muted-foreground">No pupils found in this class.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
