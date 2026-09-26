import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MoreVertical } from "lucide-react";
import { adminEnrollStudent, adminSetStudentStatus } from "@/lib/admin-students.functions";

export const Route = createFileRoute("/students")({
  head: () => ({ meta: [{ title: "Students — School Portal" }] }),
  component: () => <ProtectedAdmin><StudentsPage /></ProtectedAdmin>,
});

type StudentStatus = "active" | "withdrawn" | "transferred" | "graduated";

const STATUS_LABEL: Record<StudentStatus, string> = {
  active: "Active",
  withdrawn: "Withdrawn",
  transferred: "Transferred",
  graduated: "Graduated",
};

const STATUS_BADGE_VARIANT: Record<StudentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  withdrawn: "destructive",
  transferred: "outline",
  graduated: "secondary",
};

export function StudentsPage() {
  const qc = useQueryClient();
  const enroll = useServerFn(adminEnrollStudent);
  const setStatus = useServerFn(adminSetStudentStatus);
  const [name, setName] = useState("");
  const [classArmId, setClassArmId] = useState("");
  const [filterClassArmId, setFilterClassArmId] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"active" | "all" | StudentStatus>("active");
  const [pendingChange, setPendingChange] = useState<{ id: string; name: string; status: StudentStatus } | null>(null);
  const [reason, setReason] = useState("");

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
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, class_arm_id, status, status_reason, status_date")
        .order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string; class_arm_id: string | null; status: string; status_reason: string | null; status_date: string | null }[];
    },
  });

  const classLabel = (id: string | null) => {
    const arm = classArms.find((a) => a.id === id);
    if (!arm) return "—";
    return arm.departments?.name ? `${arm.departments.name} ${arm.name}` : arm.name;
  };

  const filtered = students.filter((s) => {
    if (filterClassArmId !== "all" && s.class_arm_id !== filterClassArmId) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    return true;
  });

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

  const statusMut = useMutation({
    mutationFn: async (input: { id: string; status: StudentStatus; reason: string }) =>
      setStatus({ data: { student_id: input.id, status: input.status, reason: input.reason || undefined } }),
    onSuccess: (_data, vars) => {
      toast.success(`Marked as ${STATUS_LABEL[vars.status].toLowerCase()}. Their records are kept — nothing was deleted.`);
      qc.invalidateQueries({ queryKey: ["students"] });
      setPendingChange(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Student Management</h2>
        <p className="text-sm text-muted-foreground">
          Register pupils by name and class. An admission number is generated automatically behind the scenes —
          it's only needed later when printing an admission letter. Taking a pupil off a class roster (withdrawn,
          transferred, or graduated) never deletes their record — their results and history stay searchable from
          Report Cards for as long as you need them.
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
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active roster</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                  <SelectItem value="all">Everyone (all-time)</SelectItem>
                </SelectContent>
              </Select>
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
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No pupils match.</TableCell></TableRow>
                )}
                {filtered.map((s) => {
                  const status = (s.status as StudentStatus) || "active";
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell>{classLabel(s.class_arm_id)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                        {s.status_reason && <div className="text-xs text-muted-foreground mt-0.5">{s.status_reason}</div>}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {status !== "active" && (
                              <DropdownMenuItem onClick={() => setPendingChange({ id: s.id, name: s.full_name, status: "active" })}>
                                Restore to active roster
                              </DropdownMenuItem>
                            )}
                            {status !== "withdrawn" && (
                              <DropdownMenuItem onClick={() => setPendingChange({ id: s.id, name: s.full_name, status: "withdrawn" })}>
                                Mark as withdrawn
                              </DropdownMenuItem>
                            )}
                            {status !== "transferred" && (
                              <DropdownMenuItem onClick={() => setPendingChange({ id: s.id, name: s.full_name, status: "transferred" })}>
                                Mark as transferred to another school
                              </DropdownMenuItem>
                            )}
                            {status !== "graduated" && (
                              <DropdownMenuItem onClick={() => setPendingChange({ id: s.id, name: s.full_name, status: "graduated" })}>
                                Mark as graduated
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingChange} onOpenChange={(open) => { if (!open) { setPendingChange(null); setReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingChange && `Mark ${pendingChange.name} as ${STATUS_LABEL[pendingChange.status].toLowerCase()}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This takes them off the active class roster. Nothing is deleted — their results, attendance, and
              report cards stay exactly as they are and remain searchable from Report Cards at any time in the future.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-1">
            <Label>Reason (optional)</Label>
            <Input
              placeholder="e.g. Parents enrolled him at another school"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={statusMut.isPending}
              onClick={() => pendingChange && statusMut.mutate({ id: pendingChange.id, status: pendingChange.status, reason })}
            >
              {statusMut.isPending ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
