import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProtectedExamOfficer } from "@/components/ProtectedExamOfficer";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createClassLevel, createClassArm, assignFormMaster, setNextClassLevel } from "@/lib/school-admin.functions";

export const Route = createFileRoute("/exam-officer/classes")({
  head: () => ({ meta: [{ title: "Classes & Arms — Exam Officer" }] }),
  component: () => <ProtectedExamOfficer><Page /></ProtectedExamOfficer>,
});

function Page() {
  const qc = useQueryClient();
  const createLevel = useServerFn(createClassLevel);
  const createArm = useServerFn(createClassArm);
  const setFormMaster = useServerFn(assignFormMaster);
  const setNextClass = useServerFn(setNextClassLevel);

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

  const lecturersQ = useQuery({
    queryKey: ["lecturers-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lecturers").select("id, full_name").order("full_name");
      if (error) throw error;
      return data;
    },
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

  const formMasterMut = useMutation({
    mutationFn: ({ class_arm_id, lecturer_id }: { class_arm_id: string; lecturer_id: string | null }) =>
      setFormMaster({ data: { class_arm_id, lecturer_id } }),
    onSuccess: () => {
      toast.success("Form master updated");
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
        <p className="text-sm text-muted-foreground">Add new class levels and arms as the school grows, and assign each arm a form master.</p>
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
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
        <CardHeader><CardTitle className="text-base">Class arms &amp; form masters</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(armsQ.data ?? []).map((arm) => (
            <div key={arm.id} className="flex flex-col gap-2 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium">{(arm.departments as { name?: string } | null)?.name} — {arm.name}</p>
                <p className="text-xs text-muted-foreground">
                  Form master: {(arm.lecturers as { full_name?: string } | null)?.full_name ?? "Not assigned"}
                </p>
              </div>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm md:w-64"
                defaultValue={arm.form_teacher_id ?? ""}
                onChange={(e) => formMasterMut.mutate({ class_arm_id: arm.id, lecturer_id: e.target.value || null })}
              >
                <option value="">Not assigned</option>
                {(lecturersQ.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.full_name}</option>
                ))}
              </select>
            </div>
          ))}
          {armsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No class arms yet — add one above.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
