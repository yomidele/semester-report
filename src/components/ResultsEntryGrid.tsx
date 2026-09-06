import { useState, useCallback, useMemo } from "react";
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
import { computeGrade, effectiveTotal } from "@/lib/grading";
import { canSubmitResult } from "@/lib/validation";

const LEVELS = [100, 200, 300, 400] as const;
const SEMESTERS = ["First", "Second"] as const;

interface Student {
  id: string;
  admission_number: string;
  full_name: string;
  level: number;
}

interface Subject {
  id: string;
  code: string;
  title: string;
  unit: number;
  level: number;
  term: string;
}

interface AcademicSession {
  id: string;
  name: string;
}

interface GridEntry {
  student_id: string;
  admission_number: string;
  full_name: string;
  ca_score: string;
  exam_score: string;
  existing_result_id?: string;
}

interface BulkSavePayload {
  student_id: string;
  subject_id: string;
  session_id: string;
  term: string;
  level: number;
  ca_score: number;
  exam_score: number;
}

export function ResultsEntryGrid() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({
    sessionId: "",
    term: "First",
    level: "100",
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

  // Fetch subjects for the selected level
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-by-level", filters.level, filters.term],
    enabled: !!filters.level && !!filters.term,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("level", Number(filters.level))
        .eq("term", filters.term)
        .order("code");
      if (error) throw error;
      return (data ?? []) as Subject[];
    },
  });

  // Fetch students at the selected level for the selected session
  // ✅ CORRECT: Join with student_academic_records (session-specific level)
  // ❌ NOT: Direct query on students.level
  const { data: levelStudents = [] } = useQuery({
    queryKey: ["students-by-session-level", filters.sessionId, filters.level],
    enabled: !!filters.sessionId && !!filters.level,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_academic_records")
        .select("students(id, admission_number, full_name)")
        .eq("academic_session_id", filters.sessionId)
        .eq("level", Number(filters.level))
        .order("students(admission_number)");
      if (error) throw error;
      
      // Flatten the nested structure
      return (data ?? []).map((record: any) => ({
        id: record.students.id,
        admission_number: record.students.admission_number,
        full_name: record.students.full_name,
        level: Number(filters.level),
      })) as Student[];
    },
  });

  // Fetch existing results for the selected subject/session/term/level
  const { data: existingResults = [] } = useQuery({
    queryKey: ["results-for-bulk", filters.sessionId, filters.subjectId, filters.term, filters.level],
    enabled: !!filters.sessionId && !!filters.subjectId && !!filters.level,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("results")
        .select("id, student_id, ca_score, exam_score")
        .eq("session_id", filters.sessionId)
        .eq("subject_id", filters.subjectId)
        .eq("term", filters.term)
        .eq("level", Number(filters.level));
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
      setFilters((prev) => ({ ...prev, [field]: value }));
      setGridEntries([]);
      setHasLoadedStudents(false);
    },
    []
  );

  // Load students into the grid
  const handleLoadStudents = useCallback(() => {
    if (!filters.sessionId || !filters.subjectId || !filters.level) {
      toast.error("Please select Session, Subject, and Level");
      return;
    }

    // Create grid entries for all students at this level
    const entries = levelStudents.map((student) => {
      const existingResult = existingResults.find((r) => r.student_id === student.id);
      return {
        student_id: student.id,
        admission_number: student.admission_number,
        full_name: student.full_name,
        ca_score: existingResult?.ca_score ? String(existingResult.ca_score) : "",
        exam_score: existingResult?.exam_score ? String(existingResult.exam_score) : "",
        existing_result_id: existingResult?.id,
      };
    });

    setGridEntries(entries);
    setHasLoadedStudents(true);
    toast.success(`Loaded ${entries.length} students`);
  }, [filters.sessionId, filters.subjectId, filters.level, levelStudents, existingResults]);

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
      // Prepare payload
      const payload: BulkSavePayload[] = gridEntries
        .filter((entry) => {
          const ca = entry.ca_score ? Number(entry.ca_score) : null;
          const exam = entry.exam_score ? Number(entry.exam_score) : null;
          return ca !== null && exam !== null && !validationStatus.errors[entry.student_id];
        })
        .map((entry) => ({
          student_id: entry.student_id,
          subject_id: filters.subjectId,
          session_id: filters.sessionId,
          term: filters.term,
          level: Number(filters.level),
          ca_score: Number(entry.ca_score),
          exam_score: Number(entry.exam_score),
        }));

      if (payload.length === 0) {
        throw new Error("No valid scores to save");
      }

      // Use a transaction-like approach with upsert
      const results = await Promise.all(
        payload.map((item) =>
          supabase.from("results").upsert(
            {
              student_id: item.student_id,
              subject_id: item.subject_id,
              session_id: item.session_id,
              term: item.term,
              level: item.level,
              ca_score: item.ca_score,
              exam_score: item.exam_score,
              status: "published",
              published_at: new Date().toISOString(),
            },
            {
              onConflict: "student_id,subject_id,session_id,term",
            }
          )
        )
      );

      // Check for errors
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
      
      // Reset grid
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
          Efficiently enter scores for multiple students at once.
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
            <Select value={filters.term} onValueChange={(value) => handleFilterChange("term", value)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEMESTERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Level Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Level</Label>
            <Select value={filters.level} onValueChange={(value) => handleFilterChange("level", value)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={String(l)}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Subject</Label>
            <Select value={filters.subjectId} onValueChange={(value) => handleFilterChange("subjectId", value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">No subjects found</div>
                ) : (
                  subjects.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code}
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
        <Card className="tsu-shadow bg-blue-50 border-blue-200">
          <CardContent className="pt-4 text-sm">
            <div className="flex gap-6">
              <div>
                <span className="font-medium">Subject:</span>
                <span className="ml-2">{selectedSubject.code} — {selectedSubject.title}</span>
              </div>
              <div>
                <span className="font-medium">Credit Units:</span>
                <span className="ml-2 font-mono">{selectedSubject.unit}</span>
              </div>
              <div>
                <span className="font-medium">Students Loaded:</span>
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
              Enter CA (0-40) and Exam (0-70) scores. Leave blank to skip a student.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Admission No</TableHead>
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
                    const isValid = !entryErrors && (entry.ca_score || entry.exam_score);

                    return (
                      <TableRow
                        key={entry.student_id}
                        className={entryErrors ? "bg-destructive/10" : ""}
                      >
                        <TableCell className="font-mono text-xs py-3">{entry.admission_number}</TableCell>
                        <TableCell className="text-sm py-3">{entry.full_name}</TableCell>
                        <TableCell className="text-center py-3">
                          <Input
                            type="number"
                            min="0"
                            max="40"
                            step="0.5"
                            value={entry.ca_score}
                            onChange={(e) => handleScoreChange(entry.student_id, "ca_score", e.target.value)}
                            placeholder="—"
                            className={`h-8 text-center text-xs ${entryErrors ? "border-destructive" : ""}`}
                          />
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <Input
                            type="number"
                            min="0"
                            max="70"
                            step="0.5"
                            value={entry.exam_score}
                            onChange={(e) => handleScoreChange(entry.student_id, "exam_score", e.target.value)}
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
                  <div className="rounded-md bg-green-50 p-3 text-sm flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-900">
                        {validationStatus.validCount} student{validationStatus.validCount !== 1 ? "s" : ""} ready to save
                      </p>
                      {validationStatus.emptyCount > 0 && (
                        <p className="text-xs text-green-700 mt-1">
                          {validationStatus.emptyCount} student{validationStatus.emptyCount !== 1 ? "s" : ""} skipped (no scores)
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
                                <span className="font-mono">{entry?.admission_number}</span>: {errors[0]}
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
            No students found at this level.
          </CardContent>
        </Card>
      )}

      {!hasLoadedStudents && (
        <Card className="tsu-shadow">
          <CardContent className="py-10 text-center text-muted-foreground">
            Select session, subject, and level, then click "Load Students" to begin.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
