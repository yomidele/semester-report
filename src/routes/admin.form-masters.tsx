import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { useRole } from "@/hooks/use-role";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { assignFormMaster } from "@/lib/school-admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/form-masters")({
  head: () => ({ meta: [{ title: "Form Master Assignments — Super Admin" }] }),
  component: () => <ProtectedAdmin><Page /></ProtectedAdmin>,
});

function Page() {
  const { isSuperAdmin, loading } = useRole();
  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin text-primary" />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;
  return <AssignmentsPage />;
}

function AssignmentsPage() {
  const qc = useQueryClient();
  const setAssignment = useServerFn(assignFormMaster);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const classesQ = useQuery({
    queryKey: ["super-admin-form-master-classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("class_arms").select("id, name, code, form_teacher_id, departments(name), lecturers:form_teacher_id(id, full_name)").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const teachersQ = useQuery({
    queryKey: ["super-admin-form-master-teachers"],
    queryFn: async () => {
      const { data: roles, error: roleError } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
      if (roleError) throw roleError;
      const userIds = (roles ?? []).map((role) => role.user_id);
      if (!userIds.length) return [];
      const { data, error } = await supabase.from("lecturers").select("id, full_name, user_id").in("user_id", userIds).order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const update = useMutation({
    mutationFn: ({ class_arm_id, lecturer_id }: { class_arm_id: string; lecturer_id: string | null }) => setAssignment({ data: { class_arm_id, lecturer_id } }),
    onSuccess: () => { toast.success("Form Master assignment updated"); qc.invalidateQueries({ queryKey: ["super-admin-form-master-classes"] }); qc.invalidateQueries({ queryKey: ["form-master-assignments"] }); qc.invalidateQueries({ queryKey: ["form-master-classes"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  return <div className="space-y-6">
    <div><h1 className="font-serif text-2xl font-bold">Form Master Assignments</h1><p className="text-sm text-muted-foreground">Assign an existing teacher to each class. Assignments add class-level access without creating a separate account.</p></div>
    <Card><CardHeader><CardTitle className="text-base">Classes and assignments</CardTitle></CardHeader><CardContent className="overflow-x-auto">
      {classesQ.isLoading || teachersQ.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-3 pr-4">Class</th><th className="py-3 pr-4">Form Master</th><th className="py-3 pr-4">Status</th><th className="py-3">Actions</th></tr></thead><tbody>
        {(classesQ.data ?? []).map((classArm: any) => {
          const currentTeacher = classArm.lecturers as { full_name: string } | null;
          const chosen = selection[classArm.id] ?? classArm.form_teacher_id ?? "";
          return <tr key={classArm.id} className="border-b"><td className="py-3 pr-4 font-medium">{classArm.departments?.name} {classArm.name}</td><td className="py-3 pr-4">{currentTeacher?.full_name ?? "Unassigned"}</td><td className="py-3 pr-4">{currentTeacher ? <span className="text-emerald-700">Active</span> : "—"}</td><td className="py-3"><div className="flex items-center gap-2"><select aria-label={`Select Form Master for ${classArm.name}`} className="h-9 min-w-48 rounded-md border border-input bg-background px-3" value={chosen} onChange={(event) => setSelection((previous) => ({ ...previous, [classArm.id]: event.target.value }))}><option value="">Choose existing teacher</option>{(teachersQ.data ?? []).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}</select><Button size="sm" disabled={!chosen || update.isPending || chosen === classArm.form_teacher_id} onClick={() => update.mutate({ class_arm_id: classArm.id, lecturer_id: chosen })}><UserRoundCheck className="mr-1 h-4 w-4" />{currentTeacher ? "Change" : "Assign"}</Button>{currentTeacher && <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => { setSelection((previous) => ({ ...previous, [classArm.id]: "" })); update.mutate({ class_arm_id: classArm.id, lecturer_id: null }); }}>Remove</Button>}</div></td></tr>;
        })}
      </tbody></table>}
      {!classesQ.isLoading && classesQ.data?.length === 0 && <p className="py-5 text-sm text-muted-foreground">Create class arms before assigning Form Masters.</p>}
    </CardContent></Card>
  </div>;
}
