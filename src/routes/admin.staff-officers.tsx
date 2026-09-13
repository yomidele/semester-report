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

export const Route = createFileRoute("/admin/staff-officers")({
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
        <h2 className="font-serif text-2xl font-bold">Exam &amp; Admission Officers</h2>
        <p className="text-sm text-muted-foreground">Create login accounts for the school-wide exam officer and admission officer roles.</p>
      </div>
      <OfficerSection
        title="Exam Officer"
        description="Assigns teachers to classes/subjects school-wide and compiles report sheets."
        roleTable="user_roles"
        roleValue="exam_officer"
        createFn={createExamOfficer}
        deleteFn={deleteExamOfficer}
      />
      <OfficerSection
        title="Admission Officer"
        description="Enrols new pupils and issues admission letters."
        roleTable="user_roles"
        roleValue="admission_officer"
        createFn={createAdmissionOfficer}
        deleteFn={deleteAdmissionOfficer}
      />
    </div>
  );
}

function OfficerSection({
  title,
  description,
  roleValue,
  createFn,
  deleteFn,
}: {
  title: string;
  description: string;
  roleTable: "user_roles";
  roleValue: "exam_officer" | "admission_officer";
  createFn: typeof createExamOfficer;
  deleteFn: typeof deleteExamOfficer;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createFn);
  const remove = useServerFn(deleteFn);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "" });

  const officersQ = useQuery({
    queryKey: ["staff-officers", roleValue],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, created_at").eq("role", roleValue).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: () => create({ data: { email: form.email.trim(), password: form.password, full_name: form.full_name.trim(), phone: form.phone.trim() || null } }),
    onSuccess: () => {
      toast.success(`${title} account created`);
      setForm({ email: "", password: "", full_name: "", phone: "" });
      qc.invalidateQueries({ queryKey: ["staff-officers", roleValue] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (user_id: string) => remove({ data: { user_id } }),
    onSuccess: () => {
      toast.success(`${title} removed`);
      qc.invalidateQueries({ queryKey: ["staff-officers", roleValue] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.email || !form.password || !form.full_name) return;
            createMut.mutate();
          }}
        >
          <div>
            <Label>Full name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <Label>Phone (optional)</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>Temporary password</Label>
            <Input type="text" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create {title}
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          {(officersQ.data ?? []).map((o) => (
            <div key={o.user_id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
              <span className="text-muted-foreground">{o.user_id}</span>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remove this ${title.toLowerCase()}?`)) removeMut.mutate(o.user_id); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {officersQ.data?.length === 0 && <p className="text-xs text-muted-foreground">None created yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
