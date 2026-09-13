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
import { createExamOfficer, deleteExamOfficer, createAdmissionOfficer, deleteAdmissionOfficer } from "@/lib/school-admin.functions";

export const Route = createFileRoute("/admin/school-officers")({
  head: () => ({ meta: [{ title: "Exam & Admission Officers — Super Admin" }] }),
  component: () => (
    <ProtectedAdmin>
      <Page />
    </ProtectedAdmin>
  ),
});

function Page() {
  const { isSuperAdmin, loading } = useRole();
  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin text-primary" />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-bold">School Officers</h2>
        <p className="text-sm text-muted-foreground">Create login accounts for the Exam Officer and Admission Officer roles.</p>
      </div>
      <OfficerSection
        title="Exam Officers"
        roleLabel="exam officer"
        listQueryKey={["exam-officers"]}
        listRole="exam_officer"
        create={createExamOfficer}
        remove={deleteExamOfficer}
      />
      <OfficerSection
        title="Admission Officers"
        roleLabel="admission officer"
        listQueryKey={["admission-officers"]}
        listRole="admission_officer"
        create={createAdmissionOfficer}
        remove={deleteAdmissionOfficer}
      />
    </div>
  );
}

function OfficerSection({
  title,
  roleLabel,
  listQueryKey,
  listRole,
  create,
  remove,
}: {
  title: string;
  roleLabel: string;
  listQueryKey: string[];
  listRole: string;
  create: typeof createExamOfficer;
  remove: typeof deleteExamOfficer;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(create);
  const removeFn = useServerFn(remove);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "" });

  const listQ = useQuery({
    queryKey: listQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, created_at").eq("role", listRole as never).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { email: form.email.trim(), password: form.password, full_name: form.full_name.trim(), phone: form.phone.trim() || null } }),
    onSuccess: () => {
      toast.success(`${title.slice(0, -1)} created`);
      setForm({ email: "", password: "", full_name: "", phone: "" });
      qc.invalidateQueries({ queryKey: listQueryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (user_id: string) => removeFn({ data: { user_id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: listQueryKey }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.email || !form.password || !form.full_name) return;
            createMut.mutate();
          }}
        >
          <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div><Label>Phone (optional)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Temporary password</Label><Input type="text" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create {roleLabel}
            </Button>
          </div>
        </form>
        <div className="space-y-1">
          {listQ.data?.map((r) => (
            <div key={r.user_id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{r.user_id}</span>
              <Button size="sm" variant="ghost" onClick={() => removeMut.mutate(r.user_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {(!listQ.data || listQ.data.length === 0) && <p className="text-sm text-muted-foreground">None yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
