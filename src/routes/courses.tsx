import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Edit2, AlertTriangle } from "lucide-react";
import { editSubject, checkEditSafety } from "@/lib/subject-editor";

export const Route = createFileRoute("/courses")({
  head: () => ({ meta: [{ title: "Subjects — School Portal" }] }),
  component: () => <ProtectedAdmin><SubjectsPage /></ProtectedAdmin>,
});

const LEVELS = [100, 200, 300, 400] as const;
const SEMESTERS = ["First", "Second"] as const;

export function SubjectsPage() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [weight, setWeight] = useState("3");
  const [level, setLevel] = useState<string>("100");
  const [term, setTerm] = useState<string>("First");

  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterSem, setFilterSem] = useState<string>("all");

  // Edit mode state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editSafety, setEditSafety] = useState<{ affectedRecords: number; warnings: string[] } | null>(null);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").order("level").order("term").order("code");
      if (error) throw error;
      return data;
    },
  });

  const filtered = subjects.filter((c) =>
    (filterLevel === "all" || c.level === Number(filterLevel)) &&
    (filterSem === "all" || c.term === filterSem)
  );

  const addMut = useMutation({
    mutationFn: async () => {
      const u = Number(weight);
      if (!code.trim() || !title.trim() || !u) throw new Error("Fill all fields");
      const { error } = await supabase.from("subjects").insert({
        code: code.trim().toUpperCase(),
        title: title.trim(),
        weight: u,
        level: Number(level),
        term,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subject added");
      setCode(""); setTitle(""); setWeight("3");
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["count", "subjects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Subject removed"); qc.invalidateQueries({ queryKey: ["subjects"] }); qc.invalidateQueries({ queryKey: ["count", "subjects"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: async () => {
      if (!editingId || !editCode.trim() || !editTitle.trim() || !editWeight) {
        throw new Error("Fill all required fields");
      }
      const result = await editSubject({
        subject_id: editingId,
        code: editCode.trim().toUpperCase(),
        title: editTitle.trim(),
        weight: Number(editWeight),
      }, "admin");
      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    },
    onSuccess: (result) => {
      toast.success(result.message);
      if (result.recalculated) {
        toast.info(`Term Average/Academic Average recalculated for ${result.affectedStudents} student term(s)`);
      }
      setEditingId(null);
      setEditSafety(null);
      qc.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleEditClick = async (subject: any) => {
    setEditingId(subject.id);
    setEditCode(subject.code);
    setEditTitle(subject.title);
    setEditWeight(String(subject.weight));
    
    // Check edit safety
    const safety = await checkEditSafety({ subject_id: subject.id });
    setEditSafety({
      affectedRecords: safety.affectedRecords,
      warnings: safety.warnings,
    });
  };

  const handleCloseEdit = () => {
    setEditingId(null);
    setEditCode("");
    setEditTitle("");
    setEditWeight("");
    setEditSafety(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Subject Setup</h2>
        <p className="text-sm text-muted-foreground">Add subjects by code, title, weight, level, and term.</p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">Add a subject</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); addMut.mutate(); }} className="grid gap-3 md:grid-cols-6">
            <div className="space-y-1.5 md:col-span-1">
              <Label>Code</Label>
              <Input placeholder="ECO101" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Title</Label>
              <Input placeholder="Introduction to Economics" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Weight</Label>
              <Input type="number" min={1} max={10} value={weight} onChange={(e) => setWeight(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={String(l)}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Term</Label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEMESTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-6">
              <Button type="submit" disabled={addMut.isPending}>{addMut.isPending ? "Saving…" : "Add subject"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">All subjects</CardTitle>
            <div className="flex gap-2">
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  {LEVELS.map((l) => <SelectItem key={l} value={String(l)}>{l} Level</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterSem} onValueChange={setFilterSem}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Term" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All terms</SelectItem>
                  {SEMESTERS.map((s) => <SelectItem key={s} value={s}>{s} Term</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-center">Weight</TableHead>
                  <TableHead className="text-center">Level</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No subjects match.</TableCell></TableRow>
                )}
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">{c.code}</TableCell>
                    <TableCell>{c.title}</TableCell>
                    <TableCell className="text-center">{c.weight}</TableCell>
                    <TableCell className="text-center">{c.level}</TableCell>
                    <TableCell>{c.term}</TableCell>
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

      {/* Edit Subject Dialog */}
      <Dialog open={!!editingId} onOpenChange={(open) => !open && handleCloseEdit()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>
              Update subject details. System-calculated fields (Term Average/Academic Average) will auto-update if weight changes.
            </DialogDescription>
          </DialogHeader>

          {editSafety && editSafety.warnings.length > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-sm text-yellow-800">
                {editSafety.warnings.map((w, i) => (
                  <div key={i}>• {w}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              editMut.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-code">Code</Label>
              <Input
                id="edit-code"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                placeholder="ECO101"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Introduction to Economics"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-weight">Weight</Label>
              <Input
                id="edit-weight"
                type="number"
                min="1"
                max="10"
                value={editWeight}
                onChange={(e) => setEditWeight(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Changing weight will recalculate affected student Term Average/Academic Average
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseEdit}>
                Cancel
              </Button>
              <Button type="submit" disabled={editMut.isPending}>
                {editMut.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
