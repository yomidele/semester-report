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
import { Loader2, Trash2 } from "lucide-react";
import { createTeacher, deleteTeacher } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/admin/teachers")({
  head: () => ({ meta: [{ title: "Teachers — Super Admin" }] }),
  component: () => <ProtectedAdmin><Page /></ProtectedAdmin>,
});

function Page() {
  const qc = useQueryClient();
  const { isSuperAdmin, loading } = useRole();
  const create = useServerFn(createTeacher);
  const remove = useServerFn(deleteTeacher);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "", department_id: "" });

  const departmentsQ = useQuery({
    queryKey: ["admin-teacher-classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const teachersQ = useQuery({
    queryKey: ["dept-teachers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lecturers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => create({ data: { ...form, department_id: form.department_id } }),
    onSuccess: () => {
      toast.success("Teacher created");
      setForm({ email: "", password: "", full_name: "", phone: "", department_id: "" });
      qc.invalidateQueries({ queryKey: ["dept-teachers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin text-primary" />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;

  const removeMut = useMutation({
    mutationFn: (user_id: string) => remove({ data: { user_id } }),
    onSuccess: () => { toast.success("Teacher removed"); qc.invalidateQueries({ queryKey: ["dept-teachers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Teachers</h2>
        <p className="text-sm text-muted-foreground">Create and manage teacher accounts. Teachers can be assigned as Form Masters without a separate account.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Add teacher</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}>
            <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><Label>Phone (optional)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Home class</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} required><option value="">Select class</option>{(departmentsQ.data ?? []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
            <div><Label>Temporary password</Label><Input minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
            <div className="flex items-end"><Button type="submit" disabled={createMut.isPending || !form.department_id}>{createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Teacher</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">All teachers</CardTitle></CardHeader>
        <CardContent>
          {teachersQ.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"><th className="py-2 pr-3">Name</th><th className="hidden py-2 pr-3 sm:table-cell">Email</th><th className="hidden py-2 pr-3 md:table-cell">Phone</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {(teachersQ.data ?? []).map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="py-2 pr-3">
                      <span className="font-medium">{l.full_name}</span>
                      <span className="block break-all text-xs text-muted-foreground sm:hidden">{l.email}</span>
                      <span className="block text-xs text-muted-foreground md:hidden">{l.phone ?? ""}</span>
                    </td>
                    <td className="hidden break-all py-2 pr-3 sm:table-cell">{l.email}</td>
                    <td className="hidden whitespace-nowrap py-2 pr-3 md:table-cell">{l.phone ?? "—"}</td>
                    <td className="py-2 text-right"><Button size="sm" variant="ghost" className="h-9 w-9 p-0" aria-label={`Remove ${l.full_name}`} onClick={() => { if (confirm(`Remove ${l.full_name}?`)) removeMut.mutate(l.user_id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                  </tr>
                ))}
                {(teachersQ.data ?? []).length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No teachers yet.</td></tr>}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
