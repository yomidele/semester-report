import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedExamOfficer } from "@/components/ProtectedExamOfficer";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/exam-officer/assignments")({
  head: () => ({ meta: [{ title: "Teacher Assignments — Exam Officer" }] }),
  component: () => <ProtectedExamOfficer><Page /></ProtectedExamOfficer>,
});

function Page() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ department_id: "", class_arm_id: "", lecturer_id: "", course_id: "", session_id: "", semester: "First" });

  const departmentsQ = useQuery({
    queryKey: ["departments-with-faculty"],
    queryFn: async () => (await supabase.from("departments").select("*, faculties:faculty_id(id, name)").order("name")).data ?? [],
  });
  const armsQ = useQuery({ queryKey: ["class-arms-all"], queryFn: async () => (await supabase.from("class_arms").select("id, name, department_id").order("name")).data ?? [] });
  const teachers = useQuery({ queryKey: ["all-teachers"], queryFn: async () => (await supabase.from("lecturers").select("id, full_name").order("full_name")).data ?? [] });
  const subjects = useQuery({ queryKey: ["all-subjects"], queryFn: async () => (await supabase.from("courses").select("id, code, title").order("code")).data ?? [] });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: async () => (await supabase.from("academic_sessions").select("id, name").order("created_at", { ascending: false })).data ?? [] });

  const assignmentsQ = useQuery({
    queryKey: ["all-assignments"],
    queryFn: async () => {
      const { data } = await supabase.from("course_assignments")
        .select("id, semester, lecturer_id, course_id, session_id, class_arm_id, lecturers(full_name), courses(code, title), academic_sessions(name), departments:department_id(name), class_arms:class_arm_id(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const armsForClass = useMemo(() => (armsQ.data ?? []).filter((a) => a.department_id === form.department_id), [armsQ.data, form.department_id]);

  const createMut = useMutation({
    mutationFn: async () => {
      const dept = departmentsQ.data?.find((d) => d.id === form.department_id);
      if (!dept) throw new Error("Select a class");
      const { error } = await supabase.from("course_assignments").insert({
        lecturer_id: form.lecturer_id,
        course_id: form.course_id,
        session_id: form.session_id,
        semester: form.semester,
        department_id: form.department_id,
        faculty_id: (dept.faculties as { id?: string } | null)?.id ?? "",
        class_arm_id: form.class_arm_id || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Teacher assigned");
      setForm({ department_id: "", class_arm_id: "", lecturer_id: "", course_id: "", session_id: "", semester: "First" });
      qc.invalidateQueries({ queryKey: ["all-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("course_assignments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["all-assignments"] }); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Teacher Assignments</h2>
        <p className="text-sm text-muted-foreground">Assign any teacher to a subject in any class — optionally scoped to a single arm.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">New assignment</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}>
            <div><Label>Class</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value, class_arm_id: "" })} required>
                <option value="">Select</option>{departmentsQ.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><Label>Arm (optional — leave blank for the whole class)</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.class_arm_id} onChange={(e) => setForm({ ...form, class_arm_id: e.target.value })} disabled={!form.department_id}>
                <option value="">Whole class</option>{armsForClass.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div><Label>Teacher</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.lecturer_id} onChange={(e) => setForm({ ...form, lecturer_id: e.target.value })} required>
                <option value="">Select</option>{teachers.data?.map((l) => <option key={l.id} value={l.id}>{l.full_name}</option>)}
              </select>
            </div>
            <div><Label>Subject</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} required>
                <option value="">Select</option>{subjects.data?.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
              </select>
            </div>
            <div><Label>Session</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.session_id} onChange={(e) => setForm({ ...form, session_id: e.target.value })} required>
                <option value="">Select</option>{sessions.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><Label>Term</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                <option value="First">First</option><option value="Second">Second</option><option value="Third">Third</option>
              </select>
            </div>
            <div className="md:col-span-3"><Button type="submit" disabled={createMut.isPending}>{createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Existing assignments</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Teacher</th><th className="py-2 pr-3">Subject</th><th className="py-2 pr-3">Class</th><th className="py-2 pr-3">Arm</th><th className="py-2 pr-3">Term</th><th></th></tr></thead>
            <tbody>
              {assignmentsQ.data?.map((a: any) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2 pr-3">{a.lecturers?.full_name}</td>
                  <td className="py-2 pr-3">{a.courses?.code} — {a.courses?.title}</td>
                  <td className="py-2 pr-3">{a.departments?.name}</td>
                  <td className="py-2 pr-3">{a.class_arms?.name ?? "Whole class"}</td>
                  <td className="py-2 pr-3">{a.semester}</td>
                  <td className="py-2 text-right"><Button size="sm" variant="ghost" onClick={() => { if (confirm("Remove assignment?")) removeMut.mutate(a.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                </tr>
              ))}
              {(!assignmentsQ.data || assignmentsQ.data.length === 0) && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No assignments yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
