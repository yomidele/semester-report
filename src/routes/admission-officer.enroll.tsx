import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProtectedAdmissionOfficer } from "@/components/ProtectedAdmissionOfficer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Download, CheckCircle2 } from "lucide-react";
import { enrollStudent } from "@/lib/school-admin.functions";
import { generateAdmissionLetterPdf } from "@/lib/admission-letter";

export const Route = createFileRoute("/admission-officer/enroll")({
  head: () => ({ meta: [{ title: "Enrol a Pupil — Admission Officer" }] }),
  component: () => <ProtectedAdmissionOfficer><Page /></ProtectedAdmissionOfficer>,
});

const emptyForm = {
  full_name: "",
  email: "",
  gender: "" as "" | "Male" | "Female" | "Other",
  date_of_birth: "",
  address: "",
  guardian_name: "",
  guardian_phone: "",
  faculty_id: "",
  department_id: "",
  class_arm_id: "",
};

function Page() {
  const enroll = useServerFn(enrollStudent);
  const [form, setForm] = useState(emptyForm);
  const [lastResult, setLastResult] = useState<{
    admission_number: string;
    full_name: string;
    admission_date: string;
    class_name: string;
    temporary_password: string;
    school: { name: string; address?: string; city?: string; state?: string; motto?: string };
  } | null>(null);

  const facultiesQ = useQuery({
    queryKey: ["faculties"],
    queryFn: async () => (await supabase.from("faculties").select("id, name").order("name")).data ?? [],
  });
  const departmentsQ = useQuery({
    queryKey: ["departments-all"],
    queryFn: async () => (await supabase.from("departments").select("id, name, faculty_id").order("name")).data ?? [],
  });
  const armsQ = useQuery({
    queryKey: ["class-arms-all"],
    queryFn: async () => (await supabase.from("class_arms").select("id, name, department_id").order("name")).data ?? [],
  });

  const departmentsForFaculty = useMemo(
    () => (departmentsQ.data ?? []).filter((d) => d.faculty_id === form.faculty_id),
    [departmentsQ.data, form.faculty_id],
  );
  const armsForClass = useMemo(
    () => (armsQ.data ?? []).filter((a) => a.department_id === form.department_id),
    [armsQ.data, form.department_id],
  );

  const enrollMut = useMutation({
    mutationFn: async () => {
      const dept = departmentsQ.data?.find((d) => d.id === form.department_id);
      const arm = armsQ.data?.find((a) => a.id === form.class_arm_id);
      const result = await enroll({
        data: {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          gender: form.gender || null,
          date_of_birth: form.date_of_birth || null,
          address: form.address.trim() || null,
          guardian_name: form.guardian_name.trim() || null,
          guardian_phone: form.guardian_phone.trim() || null,
          faculty_id: form.faculty_id,
          department_id: form.department_id,
          class_arm_id: form.class_arm_id || null,
        },
      });
      return { result, className: dept ? (arm ? `${dept.name} — ${arm.name}` : dept.name) : "" };
    },
    onSuccess: ({ result, className }) => {
      toast.success(`${result.full_name} admitted — No. ${result.admission_number}`);
      setLastResult({
        admission_number: result.admission_number,
        full_name: result.full_name,
        admission_date: result.admission_date,
        class_name: className,
        temporary_password: result.temporary_password,
        school: result.school,
      });
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadLetter = () => {
    if (!lastResult) return;
    generateAdmissionLetterPdf(lastResult);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Enrol a Pupil</h2>
        <p className="text-sm text-muted-foreground">Enter the pupil's details. An admission number and login are created immediately, and you can download the admission letter right after.</p>
      </div>

      {lastResult && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{lastResult.full_name} was admitted into {lastResult.class_name}</p>
                <p className="text-xs text-muted-foreground">Admission No: {lastResult.admission_number} · Temporary login password: <span className="font-mono">{lastResult.temporary_password}</span></p>
              </div>
            </div>
            <Button size="sm" onClick={downloadLetter}><Download className="mr-2 h-4 w-4" /> Download admission letter</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pupil details</CardTitle>
          <CardDescription>The pupil's account is created automatically — no separate application/review step.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.full_name || !form.email || !form.faculty_id || !form.department_id) return;
              enrollMut.mutate();
            }}
          >
            <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
            <div><Label>Email (for the pupil/parent login)</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><Label>Gender</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as typeof form.gender })}>
                <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
              </select>
            </div>
            <div><Label>Date of birth</Label><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Home address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Parent/Guardian name</Label><Input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} /></div>
            <div><Label>Parent/Guardian phone</Label><Input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} /></div>

            <div><Label>Section</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.faculty_id} onChange={(e) => setForm({ ...form, faculty_id: e.target.value, department_id: "", class_arm_id: "" })} required>
                <option value="">Select</option>{facultiesQ.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div><Label>Class</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value, class_arm_id: "" })} disabled={!form.faculty_id} required>
                <option value="">Select</option>{departmentsForFaculty.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><Label>Arm (optional)</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.class_arm_id} onChange={(e) => setForm({ ...form, class_arm_id: e.target.value })} disabled={!form.department_id}>
                <option value="">Not yet assigned</option>{armsForClass.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={enrollMut.isPending}>
                {enrollMut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Admitting…</> : "Admit pupil"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
