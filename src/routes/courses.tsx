import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Edit2 } from "lucide-react";

export const Route = createFileRoute("/courses")({
  head: () => ({ meta: [{ title: "Subjects — School Portal" }] }),
  component: () => <ProtectedAdmin><SubjectsPage /></ProtectedAdmin>,
});

// Every subject applies to every class it's assigned to (see Teacher
// Assignments) — the same "Mathematics" is taught in Primary 1 through
// Primary 6, so a subject itself carries no level, term, or unit-weight.
// Those were leftover college concepts (100/200/300/400 level, credit
// units) that don't apply here.
export function SubjectsPage() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editTitle, setEditTitle] = useState("");

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      if (!code.trim() || !title.trim()) throw new Error("Enter a code and a subject name");
      const { error } = await supabase.from("courses").insert({
        code: code.trim().toUpperCase(),
        title: title.trim(),
        unit: 1,
        level: null,
        semester: null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subject added");
      setCode(""); setTitle("");
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["count", "subjects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Subject removed"); qc.invalidateQueries({ queryKey: ["subjects"] }); qc.invalidateQueries({ queryKey: ["count", "subjects"] }); },
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
    },
    onSuccess: () => {
      toast.success("Subject updated");
      handleCloseEdit();
      qc.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleEditClick = (subject: { id: string; code: string; title: string }) => {
    setEditingId(subject.id);
    setEditCode(subject.code);
    setEditTitle(subject.title);
  };

  const handleCloseEdit = () => {
    setEditingId(null);
    setEditCode("");
    setEditTitle("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Subject Setup</h2>
        <p className="text-sm text-muted-foreground">
          Add each subject once — Mathematics, English Language, and so on. To teach a subject in a specific
          class, assign a teacher to it from the Exam Officer's Teacher Assignments page.
        </p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">Add a subject</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); addMut.mutate(); }} className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input placeholder="MTH" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Subject name</Label>
              <Input placeholder="Mathematics" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={addMut.isPending} className="w-full">{addMut.isPending ? "Saving…" : "Add subject"}</Button>
            </div>
          </form>
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
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && subjects.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No subjects yet — add one above.</TableCell></TableRow>
                )}
                {subjects.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">{c.code}</TableCell>
                    <TableCell>{c.title}</TableCell>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>Update the subject's code or name.</DialogDescription>
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
