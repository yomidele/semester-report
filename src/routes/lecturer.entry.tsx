import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProtectedTeacher } from "@/components/ProtectedTeacher";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, Search as SearchIcon, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { teacherSubmitResults } from "@/lib/result-workflow.functions";
import { RESULT_LIMITS, computeTotal, validateScores } from "@/lib/grading";
import { useAuthSession } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCollegeSettings } from "@/lib/college-settings";
import { resultsClassLabel } from "@/lib/class-display";
import { ResultStatusBadge, ScoreInput } from "@/components/ResultEntryParts";

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
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { settings } = useCollegeSettings();
  const { session } = useAuthSession();

  // The teacher's own subject/class assignments, for the selector at the top
  // (same query as the teacher dashboard).
  const teacherQ = useQuery({
    queryKey: ["teacher-self", session?.user.id], enabled: !!session,
    queryFn: async () => (await supabase.from("lecturers").select("id, full_name").eq("user_id", session!.user.id).maybeSingle()).data,
  });
  const myAssignmentsQ = useQuery({
    queryKey: ["teacher-assignments-entry", teacherQ.data?.id], enabled: !!teacherQ.data,
    queryFn: async () => {
      const { data } = await supabase.from("course_assignments")
        .select("id, semester, courses(code, title), academic_sessions(name), departments:department_id(name), class_arms:class_arm_id(name, code)")
        .eq("lecturer_id", teacherQ.data!.id);
      return (data ?? []) as any[];
    },
  });

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
      .select("id, lecturer_id, course_id, session_id, semester, department_id, faculty_id, class_arm_id, courses(code, title), academic_sessions(name), departments:department_id(name), class_arms:class_arm_id(name, code)")
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
        .select("id, name, code")
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
  const deptName = ((assignmentQ.data as any)?.departments?.name as string | undefined) ?? "";
  const armNameById = useMemo(
    () => Object.fromEntries(arms.map((x: any) => [x.id, resultsClassLabel(deptName, x)])),
    [arms, deptName],
  );
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
      // Pupils with no scores (e.g. absent) are simply skipped. Pupils with
      // only one score, or an out-of-range score, are also skipped and listed
      // afterwards, so one unfinished row never stops the rest of the class
      // from being saved. Blank is never saved as 0.
      const skipped: string[] = [];
      const skippedIds: string[] = [];
      const rows = Object.entries(draft)
        .filter(([_, v]) => v.ca !== "" || v.exam !== "")
        .filter(([student_id, v]) => {
          const ca = v.ca !== "" ? Number(v.ca) : null;
          const exam = v.exam !== "" ? Number(v.exam) : null;
          if (validateScores(ca, exam)) {
            skipped.push(students.find((s) => s.id === student_id)?.full_name ?? "a pupil");
            skippedIds.push(student_id);
            return false;
          }
          return true;
        })
        .map(([student_id, v]) => {
          const ca = Number(v.ca);
          const exam = Number(v.exam);
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
      if (!rows.length) {
        throw new Error(skipped.length
          ? `Nothing saved: ${skipped.length} pupil(s) need both a CA and an Exam score (${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? "…" : ""}).`
          : "Enter at least one score");
      }
      const { error } = await supabase.from("results").upsert(rows as never, { onConflict: "student_id,course_id,session_id,semester" });
      if (error) throw error;
      return { saved: rows.length, skipped, skippedIds };
    },
    onSuccess: ({ saved, skipped, skippedIds }) => {
      toast.success(`Saved ${saved} pupil${saved !== 1 ? "s" : ""} as draft`);
      if (skipped.length) {
        toast.warning(
          `Not saved — needs both CA and Exam: ${skipped.slice(0, 5).join(", ")}${skipped.length > 5 ? ` and ${skipped.length - 5} more` : ""}. Their typed scores are kept so you can finish them later.`,
          { duration: 10000 },
        );
      }
      // Keep only the unfinished rows on screen; everything saved is cleared.
      setDraft((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => skippedIds.includes(id))));
      if (!skipped.length) {
        const key = localDraftKey(assignment_id);
        if (key) {
          try { localStorage.removeItem(key); } catch { /* ignore */ }
        }
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

  const assignmentLabel = (x: any) => {
    const cls = x.departments?.name
      ? x.class_arms ? resultsClassLabel(x.departments.name, x.class_arms) : `${x.departments.name} (all arms)`
      : "";
    return `${x.courses?.code ?? ""} — ${x.courses?.title ?? ""}${cls ? ` · ${cls}` : ""} · ${x.semester} Term`;
  };

  const selector = (
    <Select value={assignment_id ?? ""} onValueChange={(v) => navigate({ to: "/lecturer/entry", search: { assignment_id: v } })}>
      <SelectTrigger className="h-11 md:h-10" aria-label="Subject and class">
        <SelectValue placeholder={myAssignmentsQ.isLoading ? "Loading your subjects…" : "Choose subject and class"} />
      </SelectTrigger>
      <SelectContent>
        {(myAssignmentsQ.data ?? []).map((x) => (
          <SelectItem key={x.id} value={x.id}>{assignmentLabel(x)}</SelectItem>
        ))}
        {!myAssignmentsQ.isLoading && (myAssignmentsQ.data ?? []).length === 0 && (
          <div className="px-2 py-2 text-sm text-muted-foreground">No subjects assigned yet. Contact the Super Admin.</div>
        )}
      </SelectContent>
    </Select>
  );

  if (!assignment_id) {
    return (
      <div className="space-y-4">
        <h2 className="font-serif text-2xl font-bold">Enter Results</h2>
        <Card className="tsu-shadow"><CardContent className="space-y-2 p-4">
          <p className="text-sm text-muted-foreground">Choose the subject and class you want to enter scores for.</p>
          {selector}
        </CardContent></Card>
      </div>
    );
  }
  if (!assignmentQ.data) return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading class…</div>;
  const a = assignmentQ.data;
  const subject = a.courses as any;
  const classLabelFor = (studentArmId: string | null) =>
    (studentArmId && armNameById[studentArmId]) ||
    ((a as any).class_arms ? resultsClassLabel(deptName, (a as any).class_arms) : deptName || "—");

  const rows = filteredStudents.map((s: any, index: number) => {
    const existing = byStudent[s.id];
    const d = draft[s.id] ?? { ca: existing?.ca_score?.toString() ?? "", exam: existing?.exam_score?.toString() ?? "" };
    const total = d.ca !== "" && d.exam !== "" ? computeTotal(d.ca, d.exam) : (existing?.total_score ?? null);
    const locked = !!existing && existing.status !== "draft";
    const ca = d.ca !== "" ? Number(d.ca) : null;
    const exam = d.exam !== "" ? Number(d.exam) : null;
    const problem = (ca !== null || exam !== null) && !locked ? validateScores(ca, exam) : null;
    return { s, index, existing, d, total, locked, problem };
  });

  const caInput = (r: (typeof rows)[number]) => (
    <ScoreInput
      ref={registerInputRef(r.s.id, "ca")}
      max={RESULT_LIMITS.ca}
      disabled={r.locked}
      invalid={!!r.problem}
      aria-label={`CA score for ${r.s.full_name}`}
      title={r.locked ? "Locked — ask the Exam Officer to return it for correction" : undefined}
      value={r.d.ca}
      placeholder="—"
      onChange={(e) => setDraft((p) => ({ ...p, [r.s.id]: { ca: e.target.value, exam: r.d.exam } }))}
      onKeyDown={handleScoreKeyDown(r.s.id, "ca")}
    />
  );
  const examInput = (r: (typeof rows)[number]) => (
    <ScoreInput
      ref={registerInputRef(r.s.id, "exam")}
      max={RESULT_LIMITS.exam}
      disabled={r.locked}
      invalid={!!r.problem}
      aria-label={`Exam score for ${r.s.full_name}`}
      title={r.locked ? "Locked — ask the Exam Officer to return it for correction" : undefined}
      value={r.d.exam}
      placeholder="—"
      onChange={(e) => setDraft((p) => ({ ...p, [r.s.id]: { ca: r.d.ca, exam: e.target.value } }))}
      onKeyDown={handleScoreKeyDown(r.s.id, "exam")}
    />
  );
  const returnedNote = (r: (typeof rows)[number]) =>
    r.existing?.status === "draft" && r.existing?.returned_reason ? (
      <p className="mt-1 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">Returned: {r.existing.returned_reason}</p>
    ) : null;

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Branded heading */}
      <div className="overflow-hidden rounded-lg border border-border bg-card tsu-shadow">
        <div className="tsu-header-grad px-4 py-3 text-sidebar-foreground md:px-6">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-accent">{settings.college_name}</p>
          <p className="text-xs text-sidebar-foreground/80">
            Academic Session {(a.academic_sessions as any)?.name ?? "—"} · {a.semester} Term
          </p>
        </div>
        <div className="space-y-4 p-4 md:p-6">
          <div>
            <h2 className="font-serif text-2xl font-bold">Enter Results</h2>
            <p className="text-sm text-muted-foreground">
              {subject?.code} — {subject?.title} · {(a as any).class_arms ? resultsClassLabel(deptName, (a as any).class_arms) : `${deptName} (all arms)`}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject / Class</span>
              {selector}
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Find a pupil</span>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Name or reg. number"
                  className="h-11 pl-9 md:h-10"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end md:col-span-2 lg:col-span-1">
              <Button className="h-11 md:h-10" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                {saveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Draft
              </Button>
              <Button className="h-11 md:h-10" variant="secondary" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
                {submitMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {scopeLabel ? `Submit ${scopeLabel} for Approval` : "Submit for Approval"}
              </Button>
            </div>
          </div>

          {showArmFilter && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Show arm">
              {[{ id: "all", label: "All arms" }, ...arms.map((x: any) => ({ id: x.id, label: armNameById[x.id] }))].map((opt) => (
                <Button
                  key={opt.id}
                  size="sm"
                  variant={armFilter === opt.id ? "default" : "outline"}
                  className="h-9"
                  onClick={() => setArmFilter(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            CA out of {RESULT_LIMITS.ca}, Exam out of {RESULT_LIMITS.exam}. Press Enter to jump to the next box. Typed scores are kept on this device until you save.
          </p>
        </div>
      </div>

      {studentsQ.isLoading && (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading pupils…</div>
      )}
      {!studentsQ.isLoading && students.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No pupils found in this class.</CardContent></Card>
      )}
      {students.length > 0 && rows.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No pupils match your search.</CardContent></Card>
      )}

      {rows.length > 0 && isMobile && (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.s.id} className={`rounded-lg border bg-card p-4 tsu-shadow ${r.problem ? "border-destructive" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-semibold leading-snug">
                    <span className="mr-1.5 text-xs font-normal text-muted-foreground">{r.index + 1}.</span>{r.s.full_name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {classLabelFor(r.s.class_arm_id)} · <span className="font-mono">{r.s.matric_number ?? "—"}</span>
                  </p>
                </div>
                <ResultStatusBadge status={r.existing?.status} returned={!!r.existing?.returned_reason} />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">CA (out of {RESULT_LIMITS.ca})</span>
                  {caInput(r)}
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Exam (out of {RESULT_LIMITS.exam})</span>
                  {examInput(r)}
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2">
                <span className="text-sm font-medium">Total</span>
                <span className="text-lg font-bold tabular-nums">{r.total ?? "—"}</span>
              </div>
              {r.problem && <p className="mt-2 text-xs text-destructive">{r.problem}</p>}
              {returnedNote(r)}
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && !isMobile && (
        <Card className="overflow-hidden tsu-shadow">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-secondary/50">
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="w-12 px-3 py-3 text-center">S/N</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Class</th>
                  <th className="px-3 py-3">Reg. No.</th>
                  <th className="w-28 px-3 py-3 text-center">CA <span className="font-normal normal-case">/{RESULT_LIMITS.ca}</span></th>
                  <th className="w-28 px-3 py-3 text-center">Exam <span className="font-normal normal-case">/{RESULT_LIMITS.exam}</span></th>
                  <th className="w-20 px-3 py-3 text-center">Total</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.s.id} className={`border-b border-border last:border-0 ${r.problem ? "bg-destructive/5" : "even:bg-muted/40"}`}>
                    <td className="px-3 py-2.5 text-center text-muted-foreground tabular-nums">{r.index + 1}</td>
                    <td className="px-3 py-2.5 font-medium">
                      {r.s.full_name}
                      {r.problem && <p className="text-xs font-normal text-destructive">{r.problem}</p>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{classLabelFor(r.s.class_arm_id)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">{r.s.matric_number ?? "—"}</td>
                    <td className="px-3 py-2">{caInput(r)}</td>
                    <td className="px-3 py-2">{examInput(r)}</td>
                    <td className="px-3 py-2.5 text-center text-base font-bold tabular-nums">{r.total ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <ResultStatusBadge status={r.existing?.status} returned={!!r.existing?.returned_reason} />
                      {returnedNote(r)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
