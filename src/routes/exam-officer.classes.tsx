import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { useRole } from "@/hooks/use-role";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { resultsClassLabel } from "@/lib/class-display";
import { createClassLevel, createClassArm, setNextClassLevel, deleteClassArm } from "@/lib/school-admin.functions";

export const Route = createFileRoute("/exam-officer/classes")({
  head: () => ({ meta: [{ title: "Classes & Arms — Exam Officer" }] }),
  component: () => <ProtectedAdmin><Page /></ProtectedAdmin>,
});

function Page() {
  const { isSuperAdmin } = useRole();
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;
  const qc = useQueryClient();
  const createLevel = useServerFn(createClassLevel);
  const createArm = useServerFn(createClassArm);
  const setNextClass = useServerFn(setNextClassLevel);
  const removeArm = useServerFn(deleteClassArm);
  const [armToDelete, setArmToDelete] = useState<{ id: string; label: string; department_id: string } | null>(null);
  const [moveTo, setMoveTo] = useState("");

  const [levelForm, setLevelForm] = useState({ faculty_id: "", name: "", code: "" });
  const [armForm, setArmForm] = useState({ department_id: "", name: "", code: "" });

  const facultiesQ = useQuery({
    queryKey: ["faculties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("faculties").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const departmentsQ = useQuery({
    queryKey: ["departments-with-faculty"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*, faculties:faculty_id(name)").order("name");
      if (error) throw error;
      return data;
    },
  });

  const armsQ = useQuery({
    queryKey: ["class-arms-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_arms")
        .select("*, departments:department_id(name), lecturers:form_teacher_id(full_name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Pupils per arm, so the delete dialog can say how many will be moved.
  const pupilCountsQ = useQuery({
    queryKey: ["class-arm-pupil-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("class_arm_id").not("class_arm_id", "is", null);
      if (error) throw error;
      const m: Record<string, number> = {};
      (data ?? []).forEach((r: { class_arm_id: string | null }) => { if (r.class_arm_id) m[r.class_arm_id] = (m[r.class_arm_id] ?? 0) + 1; });
      return m;
    },
  });

  const deleteArmMut = useMutation({
    mutationFn: () => removeArm({ data: { arm_id: armToDelete!.id, move_to_arm_id: moveTo || null } }),
    onSuccess: (r) => {
      toast.success(
        `${armToDelete?.label} deleted` +
          (r.pupils_moved ? ` — ${r.pupils_moved} pupil(s) moved to ${r.moved_to}` : "") +
          (r.teacher_assignments_removed ? `, ${r.teacher_assignments_removed} teacher assignment(s) removed` : ""),
      );
      setArmToDelete(null);
      setMoveTo("");
      qc.invalidateQueries({ queryKey: ["class-arms-full"] });
      qc.invalidateQueries({ queryKey: ["class-arm-pupil-counts"] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createLevelMut = useMutation({
    mutationFn: () => createLevel({ data: { faculty_id: levelForm.faculty_id, name: levelForm.name.trim(), code: levelForm.code.trim() } }),
    onSuccess: () => {
      toast.success("Class level added");
      setLevelForm({ faculty_id: "", name: "", code: "" });
      qc.invalidateQueries({ queryKey: ["departments-with-faculty"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createArmMut = useMutation({
    mutationFn: () => createArm({ data: { department_id: armForm.department_id, name: armForm.name.trim(), code: armForm.code.trim() } }),
    onSuccess: () => {
      toast.success("Class arm added");
      setArmForm({ department_id: "", name: "", code: "" });
      qc.invalidateQueries({ queryKey: ["class-arms-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nextClassMut = useMutation({
    mutationFn: ({ department_id, next_department_id }: { department_id: string; next_department_id: string | null }) =>
      setNextClass({ data: { department_id, next_department_id } }),
    onSuccess: () => {
      toast.success("Class progression updated");
      qc.invalidateQueries({ queryKey: ["departments-with-faculty"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Classes &amp; Arms</h2>
        <p className="text-sm text-muted-foreground">Add class levels and arms as the school grows. Manage Form Masters from the dedicated assignments section.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Add a class level</CardTitle></CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!levelForm.faculty_id || !levelForm.name || !levelForm.code) return;
              createLevelMut.mutate();
            }}
          >
            <div>
              <Label>Section</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={levelForm.faculty_id}
                onChange={(e) => setLevelForm({ ...levelForm, faculty_id: e.target.value })}
                required
              >
                <option value="">Select section</option>
                {(facultiesQ.data ?? []).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Class name</Label>
              <Input placeholder="e.g. Primary 7" value={levelForm.name} onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })} required />
            </div>
            <div>
              <Label>Short code</Label>
              <Input placeholder="e.g. PRI7" value={levelForm.code} onChange={(e) => setLevelForm({ ...levelForm, code: e.target.value })} required />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createLevelMut.isPending} className="w-full">
                {createLevelMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" /> Add class</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Class progression</CardTitle>
          <p className="text-xs text-muted-foreground">
            Set which class each level feeds into. This is what the automatic end-of-session promotion uses to move pupils up —
            without it set, pupils in that class are recorded as having completed their final class instead of being promoted.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {(departmentsQ.data ?? []).map((d) => (
            <div key={d.id} className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium">{d.name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>promotes to</span>
                <select
                  className="h-10 min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={(d as { next_department_id?: string | null }).next_department_id ?? ""}
                  onChange={(e) => nextClassMut.mutate({ department_id: d.id, next_department_id: e.target.value || null })}
                >
                  <option value="">Nothing (final class — completes on promotion)</option>
                  {(departmentsQ.data ?? []).filter((o) => o.id !== d.id).map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {departmentsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">Add a class level above first.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Add a class arm</CardTitle></CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!armForm.department_id || !armForm.name || !armForm.code) return;
              createArmMut.mutate();
            }}
          >
            <div>
              <Label>Class</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={armForm.department_id}
                onChange={(e) => setArmForm({ ...armForm, department_id: e.target.value })}
                required
              >
                <option value="">Select class</option>
                {(departmentsQ.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Arm name</Label>
              <Input placeholder="e.g. Arm C" value={armForm.name} onChange={(e) => setArmForm({ ...armForm, name: e.target.value })} required />
            </div>
            <div>
              <Label>Short code</Label>
              <Input placeholder="e.g. C" value={armForm.code} onChange={(e) => setArmForm({ ...armForm, code: e.target.value })} required />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createArmMut.isPending} className="w-full">
                {createArmMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" /> Add arm</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Class arms</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(armsQ.data ?? []).map((arm) => (
            <div key={arm.id} className="flex flex-col gap-2 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">{resultsClassLabel((arm.departments as { name?: string } | null)?.name ?? "", arm)} <span className="font-normal text-muted-foreground">({arm.name})</span></p>
                <p className="text-xs text-muted-foreground">{pupilCountsQ.data?.[arm.id] ?? 0} pupil(s)</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 self-start text-destructive hover:text-destructive md:self-center"
                onClick={() => {
                  setMoveTo("");
                  setArmToDelete({ id: arm.id, label: resultsClassLabel((arm.departments as { name?: string } | null)?.name ?? "", arm), department_id: arm.department_id });
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete arm
              </Button>
            </div>
          ))}
          {armsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No class arms yet — add one above.</p>}
        </CardContent>
      </Card>
      <AlertDialog open={!!armToDelete} onOpenChange={(o) => { if (!o) { setArmToDelete(null); setMoveTo(""); } }}>
        <AlertDialogContent>
          {(() => {
            const pupils = armToDelete ? pupilCountsQ.data?.[armToDelete.id] ?? 0 : 0;
            const otherArms = (armsQ.data ?? []).filter((a) => armToDelete && a.department_id === armToDelete.department_id && a.id !== armToDelete.id);
            const needsMove = pupils > 0;
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {armToDelete?.label}?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>
                        {needsMove
                          ? `${pupils} pupil(s) are in this arm. They and their attendance records will be moved to the arm you choose below.`
                          : "This arm has no pupils."}
                      </p>
                      <p>Teacher subject assignments for this arm only are removed. Results, report cards and pupil records are not affected.</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {needsMove && (
                  <div className="space-y-1.5">
                    <Label>Move pupils to</Label>
                    {otherArms.length > 0 ? (
                      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                        <option value="">Choose an arm</option>
                        {otherArms.map((a) => (
                          <option key={a.id} value={a.id}>{resultsClassLabel((a.departments as { name?: string } | null)?.name ?? "", a)} ({a.name})</option>
                        ))}
                      </select>
                    ) : (
                      <p className="rounded-md bg-warning/15 p-2 text-xs">This class has no other arm. Add one above first, then delete this arm.</p>
                    )}
                  </div>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <Button variant="destructive" disabled={deleteArmMut.isPending || (needsMove && !moveTo)} onClick={() => deleteArmMut.mutate()}>
                    {deleteArmMut.isPending ? "Deleting…" : "Delete arm"}
                  </Button>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
