import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ProgrammeForm = { id?: string; faculty_id: string; department_id: string; name: string; code: string; award: string; duration_years: number; uses_gpa: boolean; min_units: number; max_units: number; description: string; requirements: string; is_active: boolean };
const emptyForm: ProgrammeForm = { faculty_id: "", department_id: "", name: "", code: "", award: "", duration_years: 2, uses_gpa: true, min_units: 12, max_units: 24, description: "", requirements: "", is_active: true };

export const Route = createFileRoute("/admin/programmes")({
  head: () => ({ meta: [{ title: "Programmes — Super Admin" }] }),
  component: () => <ProtectedAdmin><Page /></ProtectedAdmin>,
});

function Page() {
  const { isSuperAdmin, loading } = useRole();
  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin text-primary" />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;
  return <ProgrammesPage />;
}

function ProgrammesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProgrammeForm>(emptyForm);
  const faculties = useQuery({ queryKey: ["admin-faculties"], queryFn: async () => { const { data, error } = await supabase.from("faculties").select("id, name").order("name"); if (error) throw error; return data ?? []; } });
  const departments = useQuery({ queryKey: ["admin-departments"], queryFn: async () => { const { data, error } = await supabase.from("departments").select("id, faculty_id, name").order("name"); if (error) throw error; return data ?? []; } });
  const programmes = useQuery({ queryKey: ["admin-programmes"], queryFn: async () => { const { data, error } = await supabase.from("programmes").select("*").order("name"); if (error) throw error; return data ?? []; } });
  const save = useMutation({ mutationFn: async () => { const values = { faculty_id: form.faculty_id, department_id: form.department_id, name: form.name.trim(), code: form.code.trim().toUpperCase(), award: form.award.trim(), duration_years: form.duration_years, uses_gpa: form.uses_gpa, min_units: form.min_units, max_units: form.max_units, description: form.description.trim() || null, requirements: form.requirements.trim() || null, is_active: form.is_active }; const response = form.id ? await supabase.from("programmes").update(values).eq("id", form.id) : await supabase.from("programmes").insert(values); if (response.error) throw response.error; }, onSuccess: () => { toast.success(form.id ? "Programme updated" : "Programme created"); setForm(emptyForm); queryClient.invalidateQueries({ queryKey: ["admin-programmes"] }); }, onError: (error: Error) => toast.error(error.message) });
  const remove = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("programmes").delete().eq("id", id); if (error) throw error; }, onSuccess: () => { toast.success("Programme removed"); queryClient.invalidateQueries({ queryKey: ["admin-programmes"] }); }, onError: (error: Error) => toast.error(error.message) });
  const set = <K extends keyof ProgrammeForm>(key: K, value: ProgrammeForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const filteredDepartments = departments.data?.filter((department) => department.faculty_id === form.faculty_id) ?? [];
  return <div className="space-y-6">
    <div><h2 className="font-serif text-2xl font-bold">Programmes</h2><p className="text-sm text-muted-foreground">Create and maintain the programmes shown on the public site.</p></div>
    <Card><CardHeader><CardTitle className="text-base">{form.id ? "Edit programme" : "Add programme"}</CardTitle></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (!form.faculty_id || !form.department_id || !form.name.trim() || !form.code.trim() || !form.award.trim()) return; save.mutate(); }}>
      <Field label="Name" value={form.name} onChange={(value) => set("name", value)} placeholder="Community Health" /><Field label="Code" value={form.code} onChange={(value) => set("code", value)} placeholder="CHEW" /><Field label="Award" value={form.award} onChange={(value) => set("award", value)} placeholder="Diploma" />
      <SelectField label="School" value={form.faculty_id} onChange={(value) => { set("faculty_id", value); set("department_id", ""); }} options={faculties.data?.map((item) => [item.id, item.name] as const) ?? []} /><SelectField label="Department" value={form.department_id} onChange={(value) => set("department_id", value)} options={filteredDepartments.map((item) => [item.id, item.name] as const)} />
      <div className="grid grid-cols-3 gap-3"><Field label="Years" type="number" value={String(form.duration_years)} onChange={(value) => set("duration_years", Number(value))} /><Field label="Min units" type="number" value={String(form.min_units)} onChange={(value) => set("min_units", Number(value))} /><Field label="Max units" type="number" value={String(form.max_units)} onChange={(value) => set("max_units", Number(value))} /></div>
      <div className="flex items-end gap-5 pb-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.uses_gpa} onChange={(event) => set("uses_gpa", event.target.checked)} /> Uses GPA</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => set("is_active", event.target.checked)} /> Active</label></div>
      <label className="space-y-1.5 text-sm font-medium md:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(event) => set("description", event.target.value)} rows={3} /></label><label className="space-y-1.5 text-sm font-medium md:col-span-2"><Label>Requirements</Label><Textarea value={form.requirements} onChange={(event) => set("requirements", event.target.value)} rows={3} /></label>
      <div className="flex gap-2 md:col-span-2"><Button type="submit" disabled={save.isPending}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : form.id ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{form.id ? "Update programme" : "Add programme"}</Button>{form.id && <Button type="button" variant="outline" onClick={() => setForm(emptyForm)}>Cancel</Button>}</div>
    </form></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">All programmes</CardTitle></CardHeader><CardContent>{programmes.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Programme</th><th className="py-2 pr-3">School / Department</th><th className="py-2 pr-3">Duration</th><th className="py-2 pr-3">Status</th><th /></tr></thead><tbody>{programmes.data?.map((programme) => { const school = faculties.data?.find((item) => item.id === programme.faculty_id); const department = departments.data?.find((item) => item.id === programme.department_id); return <tr key={programme.id} className="border-b"><td className="py-2 pr-3"><span className="font-medium">{programme.name}</span><span className="ml-2 text-xs text-muted-foreground">{programme.code}</span></td><td className="py-2 pr-3 text-muted-foreground">{school?.name ?? "-"} / {department?.name ?? "-"}</td><td className="py-2 pr-3">{programme.duration_years} years</td><td className="py-2 pr-3">{programme.is_active ? "Active" : "Inactive"}</td><td className="py-2 text-right"><Button size="sm" variant="ghost" onClick={() => setForm({ ...emptyForm, ...programme, description: programme.description ?? "", requirements: programme.requirements ?? "" })}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${programme.name}?`)) remove.mutate(programme.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></td></tr>; })}</tbody></table></div>}</CardContent></Card>
  </div>;
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) { return <label className="space-y-1.5 text-sm font-medium"><Label>{label}</Label><Input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} required /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[] }) { return <label className="space-y-1.5 text-sm font-medium"><Label>{label}</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)} required><option value="">Select {label.toLowerCase()}</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>; }
