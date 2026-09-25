import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { adminEnrollStudent } from "@/lib/admin-students.functions";

export const Route = createFileRoute("/students")({
  head: () => ({ meta: [{ title: "Students — School Portal" }] }),
  component: () => <ProtectedAdmin><StudentsPage /></ProtectedAdmin>,
});

export function StudentsPage() {
  const qc = useQueryClient();
  const enroll = useServerFn(adminEnrollStudent);
  const [name, setName] = useState("");
  const [classArmId, setClassArmId] = useState("");
  const [filterClassArmId, setFilterClassArmId] = useState("all");

  const { data: classArms = [] } = useQuery({
    queryKey: ["class-arms-for-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_arms")
        .select("id, name, departments:department_id(name)")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; departments: { name: string } | null }[];
    },
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, full_name, class_arm_id").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const classLabel = (id: string | null) => {
    const arm = classArms.find((a) => a.id === id);
    if (!arm) return "—";
    return arm.departments?.name ? `${arm.departments.name} ${arm.name}` : arm.name;
  };

  const filtered = students.filter((s) => filterClassArmId === "all" || s.class_arm_id === filterClassArmId);

  const addMut = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !classArmId) throw new Error("Enter the pupil's name and pick a class");
      return enroll({ data: { full_name: name.trim(), class_arm_id: classArmId } });
    },
    onSuccess: () => {
      toast.success("Pupil added");
      setName("");
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["count", "students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pupil removed"); qc.invalidateQueries({ queryKey: ["students"] }); qc.invalidateQueries({ queryKey: ["count", "students"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Student Management</h2>
        <p className="text-sm text-muted-foreground">
          Register pupils by name and class. An admission number is generated automatically behind the scenes —
          it's only needed later when printing an admission letter.
        </p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">Add a pupil</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); addMut.mutate(); }} className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Full name</Label>
              <Input placeholder="Tommy Ruth" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Class</Label>
              <Select value={classArmId} onValueChange={setClassArmId}>
                <SelectTrigger><SelectValue placeholder={classArms.length ? "Select class" : "Set up classes first"} /></SelectTrigger>
                <SelectContent>
                  {classArms.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.departments?.name ? `${a.departments.name} ${a.name}` : a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-4">
              <Button type="submit" disabled={addMut.isPending}>{addMut.isPending ? "Saving…" : "Add pupil"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">All pupils</CardTitle>
            <Select value={filterClassArmId} onValueChange={setFilterClassArmId}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classArms.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.departments?.name ? `${a.departments.name} ${a.name}` : a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No pupils match.</TableCell></TableRow>
                )}
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell>{classLabel(s.class_arm_id)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remove ${s.full_name}? Related results will be removed.`)) delMut.mutate(s.id); }}>
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
    </div>
  );
}
