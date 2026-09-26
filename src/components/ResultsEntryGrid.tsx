import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, AlertCircle, CheckCircle2, Search } from "lucide-react";
import { computeGrade } from "@/lib/grading";

const TERMS = ["First", "Second", "Third"] as const;

// Sentinel for the Class Arm select meaning "every arm in this class" —
// shadcn's Select can't hold a real empty string as a value.
const ALL_ARMS = "all";

interface Department {
  id: string;
  name: string;
}

interface ClassArm {
  id: string;
  name: string;
  department_id: string;
  departments: { name: string } | null;
}

interface Student {
  id: string;
  full_name: string;
  class_arm_id: string;
}

interface Subject {
  id: string;
  code: string;
  title: string;
}

interface AcademicSession {
  id: string;
  name: string;
}

interface GridEntry {
  student_id: string;
  full_name: string;
  class_arm_name: string;
  ca_score: string;
  exam_score: string;
  existing_result_id?: string;
}

// Auto-save-to-draft: while a teacher is typing scores, the in-progress grid
// is mirrored into localStorage so that navigating away (back to the
// dashboard, a refresh, a lost connection, etc.) without pressing "Save"
// never throws the entries away. The draft is scoped to the exact
// session/term/class/arm/subject combination, so switching scope never mixes
// drafts, and it's cleared the moment those scores are actually saved.
const DRAFT_PREFIX = "resultEntryDraft:v1:";

interface DraftPayload {
  savedAt: number;
  scores: Record<string, { ca_score: string; exam_score: string }>;
}

function draftKey(f: { sessionId: string; semester: string; departmentId: string; classArmId: string; subjectId: string }): string | null {
  if (!f.sessionId || !f.departmentId || !f.subjectId) return null;
  return `${DRAFT_PREFIX}${f.sessionId}:${f.semester}:${f.departmentId}:${f.classArmId || ALL_ARMS}:${f.subjectId}`;
}

function readDraft(key: string): DraftPayload | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as DraftPayload;
  } catch {
    return null;
  }
}

export function ResultsEntryGrid() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({
    sessionId: "",
    semester: "First",
    departmentId: "",
    classArmId: "", // "" = every arm in the class
    subjectId: "",
  });

  const [gridEntries, setGridEntries] = useState<GridEntry[]>([]);
  const [hasLoadedStudents, setHasLoadedStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  // Fetch sessions
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_sessions")
        .select("*")
        .order("name", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AcademicSession[];
    },
  });

  // Fetch classes (a "class" = a department, e.g. "SS2"), for the Class filter
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-for-entry"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as Department[];
    },
  });

  // Fetch every arm (e.g. "SS2 A", "SS2 B"), for the Class Arm filter
  const { data: classArms = [] } = useQuery({
    queryKey: ["class-arms-for-entry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_arms")
        .select("id, name, department_id, departments:department_id(name)")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as ClassArm[];
    },
  });

  // Arms within the chosen class filter
  const armsInDepartment = useMemo(
    () => classArms.filter((a) => a.department_id === filters.departmentId),
    [classArms, filters.departmentId]
  );

  // The actual arm ids in scope: a single arm, or every arm in the class
  // when "All arms" is picked (e.g. because the subject spans the whole class).
  const scopedArmIds = useMemo(() => {
    if (filters.classArmId) return [filters.classArmId];
    return armsInDepartment.map((a) => a.id);
  }, [filters.classArmId, armsInDepartment]);

  const armNameById = useMemo(() => {
    const m: Record<string, string> = {};
    classArms.forEach((a) => {
      m[a.id] = a.departments?.name ? `${a.departments.name} ${a.name}` : a.name;
    });
    return m;
  }, [classArms]);

  // Fetch subjects assigned to any arm in scope (see the Subjects admin page,
  // where a subject is ticked for the arms that take it — a subject that
  // spans a whole class simply has every arm ticked).
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-by-scope", scopedArmIds.slice().sort().join(",")],
    enabled: scopedArmIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_subjects")
        .select("courses:course_id(id, code, title)")
        .in("class_arm_id", scopedArmIds);
      if (error) throw error;
      const seen = new Map<string, Subject>();
      (data ?? []).forEach((r: any) => {
        if (r.courses) seen.set(r.courses.id, r.courses);
      });
      return Array.from(seen.values()).sort((a, b) => a.code.localeCompare(b.code));
    },
  });

  // Fetch pupils in scope (one arm, or every arm in the class)
  const { data: scopedStudents = [] } = useQuery({
    queryKey: ["students-by-scope", scopedArmIds.slice().sort().join(",")],
    enabled: scopedArmIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, class_arm_id")
        .in("class_arm_id", scopedArmIds)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  // Fetch existing results for the selected subject/session/term
  const { data: existingResults = [] } = useQuery({
    queryKey: ["results-for-bulk", filters.sessionId, filters.subjectId, filters.semester],
    enabled: !!filters.sessionId && !!filters.subjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("results")
        .select("id, student_id, ca_score, exam_score")
        .eq("session_id", filters.sessionId)
        .eq("course_id", filters.subjectId)
        .eq("semester", filters.semester);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Get the selected subject
  const selectedSubject = useMemo(
    () => subjects.find((c) => c.id === filters.subjectId),
    [subjects, filters.subjectId]
  );

  // Whether the grid currently spans more than one arm, so we know whether
  // to show the Arm column and whether a save covers the whole class.
  const isWholeClassView = !filters.classArmId && armsInDepartment.length > 1;

  // Handle filter changes
  const handleFilterChange = useCallback(
    (field: keyof typeof filters, value: string) => {
      setFilters((prev) => ({
        ...prev,
        [field]: value,
        ...(field === "departmentId" ? { classArmId: "", subjectId: "" } : {}),
        ...(field === "classArmId" ? { subjectId: "" } : {}),
      }));
      setGridEntries([]);
      setHasLoadedStudents(false);
      setStudentSearch("");
    },
    []
  );

  // Load students into the grid
  const handleLoadStudents = useCallback(() => {
    if (!filters.sessionId || !filters.subjectId || !filters.departmentId) {
      toast.error("Please select Session, Class, and Subject");
      return;
    }

    const entries: GridEntry[] = scopedStudents.map((student) => {
      const existingResult = existingResults.find((r) => r.student_id === student.id);
      return {
        student_id: student.id,
        full_name: student.full_name,
        class_arm_name: armNameById[student.class_arm_id] ?? "",
        ca_score: existingResult?.ca_score ? String(existingResult.ca_score) : "",
        exam_score: existingResult?.exam_score ? String(existingResult.exam_score) : "",
        existing_result_id: existingResult?.id,
      };
    });

    // Restore any unsaved scores left behind from a previous visit to this
    // exact session/term/class/arm/subject combination.
    const key = draftKey(filters);
    const draft = key ? readDraft(key) : null;
    let restoredCount = 0;
    const finalEntries = draft
      ? entries.map((entry) => {
          const d = draft.scores[entry.student_id];
          if (!d) return entry;
          if (d.ca_score === entry.ca_score && d.exam_score === entry.exam_score) return entry;
          restoredCount++;
          return { ...entry, ca_score: d.ca_score, exam_score: d.exam_score };
        })
      : entries;

    setGridEntries(finalEntries);
    setHasLoadedStudents(true);
    setStudentSearch("");
    toast.success(`Loaded ${finalEntries.length} pupil${finalEntries.length !== 1 ? "s" : ""}`);
    if (restoredCount > 0) {
      toast.info(`Restored ${restoredCount} unsaved score${restoredCount !== 1 ? "s" : ""} from where you left off`);
    }
  }, [filters, scopedStudents, existingResults, armNameById]);

  // Handle score input changes
  const handleScoreChange = useCallback(
    (studentId: string, field: "ca_score" | "exam_score", value: string) => {
      setGridEntries((prev) =>
        prev.map((entry) =>
          entry.student_id === studentId ? { ...entry, [field]: value } : entry
        )
      );
    },
    []
  );

  // Auto-save to draft: mirror any entered-but-unsaved scores into
  // localStorage as they're typed, so navigating away (e.g. back to the
  // dashboard) without clicking "Save" never loses them.
  const currentDraftKey = draftKey(filters);
  useEffect(() => {
    if (!hasLoadedStudents || !currentDraftKey) return;
    const scores: DraftPayload["scores"] = {};
    gridEntries.forEach((entry) => {
      if (entry.ca_score || entry.exam_score) {
        scores[entry.student_id] = { ca_score: entry.ca_score, exam_score: entry.exam_score };
      }
    });
    try {
      if (Object.keys(scores).length === 0) {
        localStorage.removeItem(currentDraftKey);
      } else {
        localStorage.setItem(currentDraftKey, JSON.stringify({ savedAt: Date.now(), scores } satisfies DraftPayload));
      }
    } catch {
      // localStorage can fail (private browsing, quota) — the draft is a
      // convenience, not the source of truth, so just skip it silently.
    }
  }, [gridEntries, hasLoadedStudents, currentDraftKey]);

  // Pressing Enter in a score field moves focus to the next field in
  // reading order — CA, then Exam, then the next row's CA — the same way
  // Tab would, so a teacher can keep both hands on the keyboard while
  // entering a whole class's scores. On the very last field it just blurs.
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const registerInputRef = useCallback(
    (studentId: string, field: "ca_score" | "exam_score") => (el: HTMLInputElement | null) => {
      inputRefs.current[`${studentId}-${field}`] = el;
    },
    []
  );
  const handleScoreKeyDown = useCallback(
    (studentId: string, field: "ca_score" | "exam_score") => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const idx = gridEntries.findIndex((entry) => entry.student_id === studentId);
      if (idx === -1) return;
      let nextKey: string | null = null;
      if (field === "ca_score") {
        nextKey = `${studentId}-exam_score`;
      } else if (idx < gridEntries.length - 1) {
        nextKey = `${gridEntries[idx + 1].student_id}-ca_score`;
      }
      if (nextKey && inputRefs.current[nextKey]) {
        inputRefs.current[nextKey]!.focus();
        inputRefs.current[nextKey]!.select();
      } else {
        (e.target as HTMLInputElement).blur();
      }
    },
    [gridEntries]
  );

  // Search box lets a teacher jump straight to one pupil in a long class
  // list instead of scrolling — it only narrows what's displayed, so scores
  // already entered for pupils that scroll out of view are untouched.
  const filteredEntries = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return gridEntries;
    return gridEntries.filter((entry) => entry.full_name.toLowerCase().includes(q));
  }, [gridEntries, studentSearch]);

  // Validate all entries
  const validationStatus = useMemo(() => {
    const errors: { [key: string]: string[] } = {};
    let validCount = 0;
    let emptyCount = 0;

    gridEntries.forEach((entry) => {
      const ca = entry.ca_score ? Number(entry.ca_score) : null;
      const exam = entry.exam_score ? Number(entry.exam_score) : null;

      if (ca === null && exam === null) {
        emptyCount++;
        return;
      }

      if (ca === null || exam === null) {
        errors[entry.student_id] = ["Both CA and Exam scores required"];
        return;
      }

      if (ca < 0 || ca > 40) {
        if (!errors[entry.student_id]) errors[entry.student_id] = [];
        errors[entry.student_id].push("CA must be 0-40");
      }

      if (exam < 0 || exam > 70) {
        if (!errors[entry.student_id]) errors[entry.student_id] = [];
        errors[entry.student_id].push("Exam must be 0-70");
      }

      if (!errors[entry.student_id]) {
        validCount++;
      }
    });

    return { errors, validCount, emptyCount, hasAny: validCount > 0 };
  }, [gridEntries]);

  // Bulk save mutation
  const bulkSaveMut = useMutation({
    mutationFn: async () => {
      const payload = gridEntries
        .filter((entry) => {
          const ca = entry.ca_score ? Number(entry.ca_score) : null;
          const exam = entry.exam_score ? Number(entry.exam_score) : null;
          return ca !== null && exam !== null && !validationStatus.errors[entry.student_id];
        })
        .map((entry) => ({
          student_id: entry.student_id,
          course_id: filters.subjectId,
          session_id: filters.sessionId,
          semester: filters.semester,
          ca_score: Number(entry.ca_score),
          exam_score: Number(entry.exam_score),
        }));

      if (payload.length === 0) {
        throw new Error("No valid scores to save");
      }

      const results = await Promise.all(
        payload.map((item) =>
          supabase.from("results").upsert(
            {
              student_id: item.student_id,
              course_id: item.course_id,
              session_id: item.session_id,
              semester: item.semester,
              ca_score: item.ca_score,
              exam_score: item.exam_score,
              status: "published",
              published_at: new Date().toISOString(),
            } as never,
            {
              onConflict: "student_id,course_id,session_id,semester",
            }
          )
        )
      );

      for (const result of results) {
        if (result.error) throw result.error;
      }

      return { savedCount: payload.length };
    },
    onSuccess: (data) => {
      toast.success(`Saved ${data.savedCount} score${data.savedCount !== 1 ? "s" : ""} successfully`);
      qc.invalidateQueries({ queryKey: ["results-for-bulk"] });
      qc.invalidateQueries({ queryKey: ["results-entry"] });
      qc.invalidateQueries({ queryKey: ["results"] });
      qc.invalidateQueries({ queryKey: ["history"] });

      // These scores are safely in the database now — the local safety net
      // for this scope is no longer needed.
      const key = draftKey(filters);
      if (key) {
        try {
          localStorage.removeItem(key);
        } catch {
          // ignore
        }
      }

      setGridEntries([]);
      setHasLoadedStudents(false);
      setStudentSearch("");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleClearGrid = useCallback(() => {
    const key = draftKey(filters);
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
    setGridEntries([]);
    setHasLoadedStudents(false);
    setStudentSearch("");
  }, [filters]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Bulk Results Entry</h2>
        <p className="text-sm text-muted-foreground">
          Efficiently enter scores for a whole class at once.
        </p>
      </div>

      {/* Filter Card */}
      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="text-base">Select Scope</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          {/* Session Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Session</Label>
            <Select value={filters.sessionId} onValueChange={(value) => handleFilterChange("sessionId", value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Session" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingSessions ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">Loading...</div>
                ) : sessions.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">No sessions found</div>
                ) : (
                  sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Term Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Term</Label>
            <Select value={filters.semester} onValueChange={(value) => handleFilterChange("semester", value)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERMS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s} Term
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Class Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Class</Label>
            <Select value={filters.departmentId} onValueChange={(value) => handleFilterChange("departmentId", value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                {departments.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">No classes found</div>
                ) : (
                  departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Class Arm Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Class Arm</Label>
            <Select
              value={filters.classArmId || ALL_ARMS}
              onValueChange={(value) => handleFilterChange("classArmId", value === ALL_ARMS ? "" : value)}
              disabled={!filters.departmentId}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Class Arm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ARMS}>
                  {armsInDepartment.length > 1 ? "All arms (whole class)" : "All arms"}
                </SelectItem>
                {armsInDepartment.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Subject</Label>
            <Select value={filters.subjectId} onValueChange={(value) => handleFilterChange("subjectId", value)} disabled={!filters.departmentId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    {filters.departmentId ? "No subjects assigned to this class yet" : "Pick a class first"}
                  </div>
                ) : (
                  subjects.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Load Button */}
          <div className="space-y-1.5 flex items-end">
            <Button
              onClick={handleLoadStudents}
              disabled={!filters.sessionId || !filters.subjectId || bulkSaveMut.isPending}
              className="w-full h-9"
              size="sm"
            >
              {bulkSaveMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Load Students"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Subject Details Card (shown when subject is selected) */}
      {selectedSubject && hasLoadedStudents && (
        <Card className="tsu-shadow bg-secondary/30 border-border">
          <CardContent className="pt-4 text-sm">
            <div className="flex flex-wrap gap-6">
              <div>
                <span className="font-medium">Subject:</span>
                <span className="ml-2">{selectedSubject.code} — {selectedSubject.title}</span>
              </div>
              <div>
                <span className="font-medium">Pupils Loaded:</span>
                <span className="ml-2 font-mono">{gridEntries.length}</span>
              </div>
              {isWholeClassView && (
                <div>
                  <span className="font-medium">Scope:</span>
                  <span className="ml-2">Whole class — every arm</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid Entry Table */}
      {hasLoadedStudents && gridEntries.length > 0 && (
        <Card className="tsu-shadow">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Enter Scores</CardTitle>
                <p className="text-xs text-muted-foreground mt-2">
                  Enter CA (0-40) and Exam (0-70) scores. Leave blank to skip a pupil.
                </p>
              </div>
              <div className="relative sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search pupil by name..."
                  className="h-9 pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    {isWholeClassView && <TableHead className="text-xs">Arm</TableHead>}
                    <TableHead className="text-center text-xs">CA (0-40)</TableHead>
                    <TableHead className="text-center text-xs">Exam (0-70)</TableHead>
                    <TableHead className="text-center text-xs">Total</TableHead>
                    <TableHead className="text-center text-xs">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isWholeClassView ? 6 : 5} className="text-center text-sm text-muted-foreground py-8">
                        No pupils match "{studentSearch}"
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredEntries.map((entry) => {
                    const ca = entry.ca_score ? Number(entry.ca_score) : 0;
                    const exam = entry.exam_score ? Number(entry.exam_score) : 0;
                    const total = entry.ca_score && entry.exam_score ? Math.min(ca + exam, 100) : null;
                    const grade = total !== null ? computeGrade(total) : null;
                    const entryErrors = validationStatus.errors[entry.student_id];

                    return (
                      <TableRow
                        key={entry.student_id}
                        className={entryErrors ? "bg-destructive/10" : ""}
                      >
                        <TableCell className="text-sm py-3">{entry.full_name}</TableCell>
                        {isWholeClassView && (
                          <TableCell className="text-xs text-muted-foreground py-3">{entry.class_arm_name}</TableCell>
                        )}
                        <TableCell className="text-center py-3">
                          <Input
                            ref={registerInputRef(entry.student_id, "ca_score")}
                            type="number"
                            min="0"
                            max="40"
                            step="0.5"
                            value={entry.ca_score}
                            onChange={(e) => handleScoreChange(entry.student_id, "ca_score", e.target.value)}
                            onKeyDown={handleScoreKeyDown(entry.student_id, "ca_score")}
                            placeholder="—"
                            className={`h-8 text-center text-xs ${entryErrors ? "border-destructive" : ""}`}
                          />
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <Input
                            ref={registerInputRef(entry.student_id, "exam_score")}
                            type="number"
                            min="0"
                            max="70"
                            step="0.5"
                            value={entry.exam_score}
                            onChange={(e) => handleScoreChange(entry.student_id, "exam_score", e.target.value)}
                            onKeyDown={handleScoreKeyDown(entry.student_id, "exam_score")}
                            placeholder="—"
                            className={`h-8 text-center text-xs ${entryErrors ? "border-destructive" : ""}`}
                          />
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium py-3">
                          {total !== null ? total : "—"}
                        </TableCell>
                        <TableCell className="text-center py-3">
                          {grade ? (
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                grade.grade === "F"
                                  ? "bg-destructive text-destructive-foreground"
                                  : "bg-primary text-primary-foreground"
                              }`}
                            >
                              {grade.grade}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Validation Summary */}
            {validationStatus.validCount > 0 || Object.keys(validationStatus.errors).length > 0 ? (
              <div className="px-4 py-4 border-t space-y-3">
                {validationStatus.validCount > 0 && (
                  <div className="rounded-md bg-secondary/35 p-3 text-sm flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary-dark flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">
                        {validationStatus.validCount} pupil{validationStatus.validCount !== 1 ? "s" : ""} ready to save
                      </p>
                      {validationStatus.emptyCount > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {validationStatus.emptyCount} pupil{validationStatus.emptyCount !== 1 ? "s" : ""} skipped (no scores)
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {Object.keys(validationStatus.errors).length > 0 && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm flex gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">
                        {Object.keys(validationStatus.errors).length} error{Object.keys(validationStatus.errors).length !== 1 ? "s" : ""}
                      </p>
                      <ul className="text-xs text-destructive mt-2 space-y-1 list-disc list-inside">
                        {Object.entries(validationStatus.errors)
                          .slice(0, 3)
                          .map(([studentId, errors]) => {
                            const entry = gridEntries.find((e) => e.student_id === studentId);
                            return (
                              <li key={studentId}>
                                <span>{entry?.full_name}</span>: {errors[0]}
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Save Button */}
            <div className="px-4 py-4 border-t flex gap-2">
              <Button
                onClick={() => bulkSaveMut.mutate()}
                disabled={!validationStatus.hasAny || bulkSaveMut.isPending}
                size="sm"
              >
                {bulkSaveMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  `Save All Scores (${validationStatus.validCount})`
                )}
              </Button>
              <Button onClick={handleClearGrid} variant="outline" size="sm">
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {hasLoadedStudents && gridEntries.length === 0 && (
        <Card className="tsu-shadow">
          <CardContent className="py-10 text-center text-muted-foreground">
            No pupils found in this class.
          </CardContent>
        </Card>
      )}

      {!hasLoadedStudents && (
        <Card className="tsu-shadow">
          <CardContent className="py-10 text-center text-muted-foreground">
            Select session, class, and subject, then click "Load Students" to begin.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
