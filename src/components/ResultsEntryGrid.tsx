import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { computeGrade } from "@/lib/grading";

const TERMS = ["First", "Second", "Third"] as const;

interface ClassArm {
  id: string;
  name: string;
  department_id: string;
  departments: { name: string } | null;
}

interface Student {
  id: string;
  full_name: string;
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
  ca_score: string;
  exam_score: string;
  existing_result_id?: string;
}

export function ResultsEntryGrid() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({
    sessionId: "",
    semester: "First",
    classArmId: "",
    subjectId: "",
  });

  const [gridEntries, setGridEntries] = useState<GridEntry[]>([]);
  const [hasLoadedStudents, setHasLoadedStudents] = useState(false);

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

  // Fetch classes (arms), for the Class filter
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

  // Fetch subjects assigned to the selected class (see Subjects admin page,
  // where a subject is ticked for the classes that take it).
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-by-class", filters.classArmId],
    enabled: !!filters.classArmId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_subjects")
        .select("courses:course_id(id, code, title)")
        .eq("class_arm_id", filters.classArmId);
      if (error) throw error;
      return ((data ?? []).map((r: any) => r.courses).filter(Boolean) as Subject[]).sort((a, b) => a.code.localeCompare(b.code));
    },
  });

  // Fetch pupils in the selected class
  const { data: classStudents = [] } = useQuery({
    queryKey: ["students-by-class", filters.classArmId],
    enabled: !!filters.classArmId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name")
        .eq("class_arm_id", filters.classArmId)
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

  // Handle filter changes
  const handleFilterChange = useCallback(
    (field: keyof typeof filters, value: string) => {
      setFilters((prev) => ({ ...prev, [field]: value, ...(field === "classArmId" ? { subjectId: "" } : {}) }));
      setGridEntries([]);
      setHasLoadedStudents(false);
    },
    []
  );

  // Load students into the grid
  const handleLoadStudents = useCallback(() => {
    if (!filters.sessionId || !filters.subjectId || !filters.classArmId) {
      toast.error("Please select Session, Class, and Subject");
      return;
    }

    const entries = classStudents.map((student) => {
      const existingResult = existingResults.find((r) => r.student_id === student.id);
      return {
        student_id: student.id,
        full_name: student.full_name,
        ca_score: existingResult?.ca_score ? String(existingResult.ca_score) : "",
        exam_score: existingResult?.exam_score ? String(existingResult.exam_score) : "",
        existing_result_id: existingResult?.id,
      };
    });

    setGridEntries(entries);
    setHasLoadedStudents(true);
    toast.success(`Loaded ${entries.length} pupils`);
  }, [filters.sessionId, filters.subjectId, filters.classArmId, classStudents, existingResults]);

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

      setGridEntries([]);
      setHasLoadedStudents(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

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
        <CardContent className="grid gap-3 md:grid-cols-5">
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
            <Select value={filters.classArmId} onValueChange={(value) => handleFilterChange("classArmId", value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                {classArms.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">No classes found</div>
                ) : (
                  classArms.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.departments?.name ? `${c.departments.name} ${c.name}` : c.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Subject</Label>
            <Select value={filters.subjectId} onValueChange={(value) => handleFilterChange("subjectId", value)} disabled={!filters.classArmId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    {filters.classArmId ? "No subjects assigned to this class yet" : "Pick a class first"}
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
            <div className="flex gap-6">
              <div>
                <span className="font-medium">Subject:</span>
                <span className="ml-2">{selectedSubject.code} — {selectedSubject.title}</span>
              </div>
              <div>
                <span className="font-medium">Pupils Loaded:</span>
                <span className="ml-2 font-mono">{gridEntries.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid Entry Table */}
      {hasLoadedStudents && gridEntries.length > 0 && (
        <Card className="tsu-shadow">
          <CardHeader>
            <CardTitle className="text-base">Enter Scores</CardTitle>
            <p className="text-xs text-muted-foreground mt-2">
              Enter CA (0-40) and Exam (0-70) scores. Leave blank to skip a pupil.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-center text-xs">CA (0-40)</TableHead>
                    <TableHead className="text-center text-xs">Exam (0-70)</TableHead>
                    <TableHead className="text-center text-xs">Total</TableHead>
                    <TableHead className="text-center text-xs">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gridEntries.map((entry) => {
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
              <Button
                onClick={() => {
                  setGridEntries([]);
                  setHasLoadedStudents(false);
                }}
                variant="outline"
                size="sm"
              >
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
