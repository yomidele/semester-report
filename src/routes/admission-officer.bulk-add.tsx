import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProtectedAdmissionOfficer } from "@/components/ProtectedAdmissionOfficer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Download, Loader2, Users } from "lucide-react";
import { bulkEnrollStudents } from "@/lib/school-admin.functions";
import { generateBulkAdmissionLettersPdf } from "@/lib/admission-letter";

export const Route = createFileRoute("/admission-officer/bulk-add")({
  head: () => ({ meta: [{ title: "Bulk Add Pupils — Admission Officer" }] }),
  component: () => <ProtectedAdmissionOfficer><Page /></ProtectedAdmissionOfficer>,
});

function Page() {
  const bulkEnroll = useServerFn(bulkEnrollStudents);
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [armId, setArmId] = useState("");
  const [namesText, setNamesText] = useState("");
  const [lastResult, setLastResult] = useState<Awaited<ReturnType<typeof bulkEnroll>> | null>(null);
  const [lastClassName, setLastClassName] = useState("");

  const facultiesQ = useQuery({ queryKey: ["faculties"], queryFn: async () => (await supabase.from("faculties").select("id, name").order("name")).data ?? [] });
  const departmentsQ = useQuery({ queryKey: ["departments-with-faculty"], queryFn: async () => (await supabase.from("departments").select("id, name, faculty_id").order("name")).data ?? [] });
  const armsQ = useQuery({ queryKey: ["class-arms-all"], queryFn: async () => (await supabase.from("class_arms").select("id, name, department_id").order("name")).data ?? [] });

  const departmentsForFaculty = useMemo(() => (departmentsQ.data ?? []).filter((d) => d.faculty_id === facultyId), [departmentsQ.data, facultyId]);
  const armsForClass = useMemo(() => (armsQ.data ?? []).filter((a) => a.department_id === departmentId), [armsQ.data, departmentId]);

  const names = useMemo(
    () => namesText.split("\n").map((n) => n.trim()).filter(Boolean),
    [namesText],
  );

  const bulkMut = useMutation({
    mutationFn: () =>
      bulkEnroll({
        data: { faculty_id: facultyId, department_id: departmentId, class_arm_id: armId || null, full_names: names },
      }),
    onSuccess: (result) => {
      toast.success(`${result.count} pupils added`);
      const dept = departmentsQ.data?.find((d) => d.id === departmentId);
      const arm = armsQ.data?.find((a) => a.id === armId);
      setLastClassName([dept?.name, arm?.name].filter(Boolean).join(" — "));
      setLastResult(result);
      setNamesText("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadLetters = () => {
    if (!lastResult) return;
    generateBulkAdmissionLettersPdf(
      lastResult.pupils.map((p) => ({
        admission_number: p.admission_number,
        full_name: p.full_name,
        admission_date: new Date().toISOString(),
        class_name: lastClassName || "the assigned class",
        school: lastResult.school,
      })),
      lastClassName || "class",
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Bulk Add Pupils</h2>
        <p className="text-sm text-muted-foreground">
          Paste a class list — one name per line — to add a whole class at once. This does not create a login for each
          pupil (most class lists have no parent email); it creates their record and admission number immediately, so
          they show up on rosters and report sheets right away. If an arm's pupils come from more than one list (e.g.
          two photos for the same 4A), just run this again for the same class and arm — it adds to the existing list,
          it doesn't replace it.
        </p>
      </div>

      {lastResult && (
        <Card className="border-green-600/40 bg-green-50 dark:bg-green-950/20">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="text-sm font-medium">{lastResult.count} pupils added to {lastClassName}</p>
                <p className="text-xs text-muted-foreground">Admission numbers assigned automatically</p>
              </div>
            </div>
            <Button size="sm" onClick={downloadLetters}><Download className="mr-2 h-4 w-4" /> Download all admission letters</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Class list</CardTitle>
          <CardDescription>Select the class this list belongs to, then paste the names below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Section</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={facultyId} onChange={(e) => { setFacultyId(e.target.value); setDepartmentId(""); setArmId(""); }} required>
                <option value="">Select section</option>
                {facultiesQ.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Class</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setArmId(""); }} disabled={!facultyId} required>
                <option value="">Select class</option>
                {departmentsForFaculty.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Arm (optional)</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={armId} onChange={(e) => setArmId(e.target.value)} disabled={!departmentId}>
                <option value="">Not yet assigned</option>
                {armsForClass.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label>Pupils' names — one per line</Label>
            <textarea
              className="min-h-[220px] w-full rounded-md border border-input bg-background p-3 text-sm"
              placeholder={"Abubakar Musa\nFatima Ibrahim\nChinedu Okafor\n..."}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">{names.length} name{names.length === 1 ? "" : "s"} detected</p>
          </div>

          <Button
            disabled={bulkMut.isPending || !facultyId || !departmentId || names.length === 0}
            onClick={() => bulkMut.mutate()}
          >
            {bulkMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
            Add {names.length || ""} pupil{names.length === 1 ? "" : "s"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
