import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Edit2, ListPlus, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/courses")({
  head: () => ({ meta: [{ title: "Subjects — School Portal" }] }),
  component: () => <ProtectedAdmin><SubjectsPage /></ProtectedAdmin>,
});

// Every subject applies to every class it's assigned to (see Teacher
// Assignments) — the same "Mathematics" is taught in Primary 1 through
// Primary 6, so a subject itself carries no level, term, or unit-weight.
// Those were leftover college concepts (100/200/300/400 level, credit
// units) that don't apply here.
// A subject still needs a short code internally (it shows on report cards
// and result sheets), but typing one shouldn't be required — most people
// just want to type "Mathematics" and move on. When no code is given, one is
// derived from the subject's name and made unique against existing codes.
function deriveCodeFromTitle(title: string): string {
  const firstWord = title.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/)[0] ?? "";
  const base = firstWord.slice(0, 3).toUpperCase();
  return base.length >= 2 ? base : "SUB";
}

function uniqueCodeFromTitle(title: string, used: Set<string>): string {
  const base = deriveCodeFromTitle(title);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}${suffix}`;
    suffix++;
  }
  return candidate;
}

export function SubjectsPage() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editSelectedClassIds, setEditSelectedClassIds] = useState<string[]>([]);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });

  // All classes a subject can be assigned to, for the "which classes take
  // this subject" multi-select below.
  const { data: classArms = [] } = useQuery({
    queryKey: ["class-arms-for-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_arms")
        .select("id, name, department_id, departments:department_id(name)")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; department_id: string; departments: { name: string } | null }[];
    },
  });

  // Every subject <-> class link, so we can show a count per subject and
  // pre-tick the right boxes when editing.
  const { data: classSubjects = [] } = useQuery({
    queryKey: ["class-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("class_subjects").select("course_id, class_arm_id");
      if (error) throw error;
      return data as { course_id: string; class_arm_id: string }[];
    },
  });

  const classCountBySubject = useMemo(() => {
    const m: Record<string, number> = {};
    classSubjects.forEach((cs) => { m[cs.course_id] = (m[cs.course_id] ?? 0) + 1; });
    return m;
  }, [classSubjects]);

  // Sync the class_subjects rows for one subject to exactly `classIds`.
  // Simplest correct approach for a small join table: replace the set
  // rather than diffing inserts/deletes.
  async function syncClassSubjects(courseId: string, classIds: string[]) {
    const { error: delErr } = await supabase.from("class_subjects").delete().eq("course_id", courseId);
    if (delErr) throw delErr;
    if (classIds.length > 0) {
      const { error: insErr } = await supabase
        .from("class_subjects")
        .insert(classIds.map((class_arm_id) => ({ course_id: courseId, class_arm_id })) as never);
      if (insErr) throw insErr;
    }
  }

  const addMut = useMutation({
    mutationFn: async () => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) throw new Error("Enter a subject name");
      const finalCode = code.trim()
        ? code.trim().toUpperCase()
        : uniqueCodeFromTitle(trimmedTitle, new Set(subjects.map((s: any) => String(s.code).toUpperCase())));
      const { data, error } = await supabase
        .from("courses")
        .insert({
          code: finalCode,
          title: trimmedTitle,
          unit: 1,
          level: null,
          semester: null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      if (selectedClassIds.length > 0) await syncClassSubjects((data as any).id, selectedClassIds);
    },
    onSuccess: () => {
      toast.success("Subject added");
      setCode(""); setTitle(""); setSelectedClassIds([]);
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["class-subjects"] });
      qc.invalidateQueries({ queryKey: ["count", "subjects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Bulk add subjects --------------------------------------------------
  // One subject per line. Just the name is enough ("Mathematics") — a code
  // is generated automatically. To choose your own code, write
  // "CODE - Subject Name" (a colon, comma, or a tab pasted from a
  // spreadsheet works too). Classes ticked below apply to every subject in
  // the batch; if a subject needs a different set of classes, add or edit
  // it individually afterward.
  const [bulkText, setBulkText] = useState("");
  const [bulkClassIds, setBulkClassIds] = useState<string[]>([]);
  const [bulkReport, setBulkReport] = useState<{ added: string[]; skippedDuplicate: string[]; skippedInvalid: string[] } | null>(null);

  const parsedBulkLines = useMemo(() => {
    const usedCodes = new Set(subjects.map((s: any) => String(s.code).toUpperCase()));
    const existingTitles = new Set(subjects.map((s: any) => String(s.title).trim().toUpperCase()));
    const seenTitles = new Set<string>();
    const rows: { raw: string; code: string | null; title: string | null; status: "ok" | "invalid" | "duplicate" }[] = [];

    for (const rawLine of bulkText.split("\n")) {
      const raw = rawLine.trim();
      if (!raw) continue;

      // An explicit "CODE - Title" (or colon / comma / tab) wins. With no
      // separator the whole line is the subject name and its code is
      // generated, so nobody has to invent codes.
      const separatorMatch = raw.match(/^(.+?)\s*[-:,\t]\s*(.+)$/);

      if (separatorMatch) {
        const code = separatorMatch[1]?.trim().toUpperCase() || null;
        const title = separatorMatch[2]?.trim() || null;
        if (!code || !title) {
          rows.push({ raw, code: null, title: null, status: "invalid" });
          continue;
        }
        if (usedCodes.has(code)) {
          rows.push({ raw, code, title, status: "duplicate" });
          continue;
        }
        usedCodes.add(code);
        rows.push({ raw, code, title, status: "ok" });
      } else {
        const titleKey = raw.toUpperCase();
        if (existingTitles.has(titleKey) || seenTitles.has(titleKey)) {
          rows.push({ raw, code: null, title: raw, status: "duplicate" });
          continue;
        }
        seenTitles.add(titleKey);
        const code = uniqueCodeFromTitle(raw, usedCodes);
        usedCodes.add(code);
        rows.push({ raw, code, title: raw, status: "ok" });
      }
    }
    return rows;
  }, [bulkText, subjects]);

  const bulkValidRows = useMemo(() => parsedBulkLines.filter((r) => r.status === "ok"), [parsedBulkLines]);

  const bulkAddMut = useMutation({
    mutationFn: async () => {
      if (bulkValidRows.length === 0) throw new Error("No new subjects to add — check the list below");
      const { data: inserted, error } = await supabase
        .from("courses")
        .insert(bulkValidRows.map((r) => ({ code: r.code, title: r.title, unit: 1, level: null, semester: null })) as never)
        .select("id, code");
      if (error) throw error;
      const ids = (inserted as { id: string; code: string }[]).map((r) => r.id);
      if (bulkClassIds.length > 0 && ids.length > 0) {
        const { error: linkErr } = await supabase
          .from("class_subjects")
          .insert(ids.flatMap((course_id) => bulkClassIds.map((class_arm_id) => ({ course_id, class_arm_id }))) as never);
        if (linkErr) throw linkErr;
      }
      return inserted as { id: string; code: string }[];
    },
    onSuccess: (inserted) => {
      toast.success(`${inserted.length} subject${inserted.length !== 1 ? "s" : ""} added`);
      setBulkReport({
        added: bulkValidRows.map((r) => `${r.code} — ${r.title}`),
        skippedDuplicate: parsedBulkLines.filter((r) => r.status === "duplicate").map((r) => (r.code ? `${r.code} — ${r.title}` : (r.title ?? r.raw))),
        skippedInvalid: parsedBulkLines.filter((r) => r.status === "invalid").map((r) => r.raw),
      });
      setBulkText("");
      setBulkClassIds([]);
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["class-subjects"] });
      qc.invalidateQueries({ queryKey: ["count", "subjects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Subject removed"); qc.invalidateQueries({ queryKey: ["subjects"] }); qc.invalidateQueries({ queryKey: ["class-subjects"] }); qc.invalidateQueries({ queryKey: ["count", "subjects"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: async () => {
      if (!editingId || !editCode.trim() || !editTitle.trim()) throw new Error("Enter a code and a subject name");
      const { error } = await supabase.from("courses").update({
        code: editCode.trim().toUpperCase(),
        title: editTitle.trim(),
      } as never).eq("id", editingId);
      if (error) throw error;
      await syncClassSubjects(editingId, editSelectedClassIds);
    },
    onSuccess: () => {
      toast.success("Subject updated");
      handleCloseEdit();
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["class-subjects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleEditClick = (subject: { id: string; code: string; title: string }) => {
    setEditingId(subject.id);
    setEditCode(subject.code);
    setEditTitle(subject.title);
    setEditSelectedClassIds(classSubjects.filter((cs) => cs.course_id === subject.id).map((cs) => cs.class_arm_id));
  };

  const handleCloseEdit = () => {
    setEditingId(null);
    setEditCode("");
    setEditTitle("");
    setEditSelectedClassIds([]);
  };

  function toggleClass(ids: string[], setIds: (v: string[]) => void, classId: string) {
    setIds(ids.includes(classId) ? ids.filter((id) => id !== classId) : [...ids, classId]);
  }

  function ClassCheckboxList({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
    if (classArms.length === 0) {
      return <p className="text-xs text-muted-foreground">No classes set up yet — add classes from Classes &amp; Arms first.</p>;
    }
    return (
      <div className="grid max-h-48 gap-2 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2 md:grid-cols-3">
        {classArms.map((arm) => (
          <label key={arm.id} className="flex items-center gap-2 text-sm">
            <Checkbox checked={selected.includes(arm.id)} onCheckedChange={() => onToggle(arm.id)} />
            <span>{arm.departments?.name ? `${arm.departments.name} ` : ""}{arm.name}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Subject Setup</h2>
        <p className="text-sm text-muted-foreground">
          Add each subject once — Mathematics, English Language, and so on — then tick which classes take it.
          To assign a teacher to teach a subject in a specific class, use the Exam Officer's Teacher Assignments page.
        </p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">Add a subject</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(e) => { e.preventDefault(); addMut.mutate(); }} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Code <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input placeholder="Auto" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Subject name</Label>
                <Input placeholder="Mathematics" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={addMut.isPending} className="w-full">{addMut.isPending ? "Saving…" : "Add subject"}</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Classes taking this subject</Label>
              <ClassCheckboxList selected={selectedClassIds} onToggle={(id) => toggleClass(selectedClassIds, setSelectedClassIds, id)} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ListPlus className="h-4 w-4" /> Bulk add subjects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            One subject per line — just the name is enough, and a code is generated for you. To pick your own code, write{" "}
            <span className="font-mono">CODE - Subject Name</span>. The classes ticked below apply to every subject in this batch.
          </p>
          <div className="space-y-1.5">
            <Label>Subjects</Label>
            <Textarea
              className="min-h-[160px] font-mono text-sm"
              placeholder={"Mathematics\nEnglish Language\nSCI - Basic Science (own code, optional)"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            {bulkText.trim().length > 0 && (
              <p className="text-xs text-muted-foreground">
                {bulkValidRows.length} new subject{bulkValidRows.length !== 1 ? "s" : ""} detected
                {parsedBulkLines.some((r) => r.status !== "ok") && (
                  <> — {parsedBulkLines.filter((r) => r.status === "duplicate").length} already exist,{" "}
                  {parsedBulkLines.filter((r) => r.status === "invalid").length} couldn't be read</>
                )}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Classes taking these subjects</Label>
            <ClassCheckboxList selected={bulkClassIds} onToggle={(id) => toggleClass(bulkClassIds, setBulkClassIds, id)} />
          </div>
          <Button
            disabled={bulkAddMut.isPending || bulkValidRows.length === 0}
            onClick={() => bulkAddMut.mutate()}
          >
            {bulkAddMut.isPending ? "Adding…" : `Add ${bulkValidRows.length || ""} subject${bulkValidRows.length === 1 ? "" : "s"}`}
          </Button>

          {bulkReport && (
            <div className="space-y-2 rounded-md border border-border p-3 text-sm">
              {bulkReport.added.length > 0 && (
                <p className="flex items-start gap-2 text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Added: {bulkReport.added.join(", ")}</p>
              )}
              {bulkReport.skippedDuplicate.length > 0 && (
                <p className="flex items-start gap-2 text-amber-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Skipped (already exist): {bulkReport.skippedDuplicate.join(", ")}</p>
              )}
              {bulkReport.skippedInvalid.length > 0 && (
                <p className="flex items-start gap-2 text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Couldn't be read — check the format: {bulkReport.skippedInvalid.join(" | ")}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">All subjects</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Classes</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && subjects.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No subjects yet — add one above.</TableCell></TableRow>
                )}
                {subjects.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">{c.code}</TableCell>
                    <TableCell>{c.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {classCountBySubject[c.id] ? `${classCountBySubject[c.id]} class${classCountBySubject[c.id] !== 1 ? "es" : ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleEditClick(c)} className="mr-2">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${c.code}? Related results will be removed.`)) delMut.mutate(c.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingId} onOpenChange={(open) => !open && handleCloseEdit()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>Update the subject's code, name, or which classes take it.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); editMut.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">Code</Label>
              <Input id="edit-code" value={editCode} onChange={(e) => setEditCode(e.target.value)} placeholder="MTH" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Subject name</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Mathematics" required />
            </div>
            <div className="space-y-2">
              <Label>Classes taking this subject</Label>
              <ClassCheckboxList selected={editSelectedClassIds} onToggle={(id) => toggleClass(editSelectedClassIds, setEditSelectedClassIds, id)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseEdit}>Cancel</Button>
              <Button type="submit" disabled={editMut.isPending}>{editMut.isPending ? "Saving…" : "Save Changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
