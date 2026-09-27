import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmissionOfficer } from "@/components/ProtectedAdmissionOfficer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCollegeSettings } from "@/lib/college-settings";
import { generateAdmissionLetterPdf } from "@/lib/admission-letter";
import { Download, Search, UserRound } from "lucide-react";

export const Route = createFileRoute("/admission-officer/records")({
  head: () => ({ meta: [{ title: "Admission Records — Admission Officer" }] }),
  component: () => (
    <ProtectedAdmissionOfficer>
      <RecordsPage />
    </ProtectedAdmissionOfficer>
  ),
});

type StudentListRow = {
  id: string;
  full_name: string;
  matric_number: string;
  status: string;
};

type StudentDetail = {
  id: string;
  full_name: string;
  matric_number: string;
  email: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  status: string;
  admission_date: string;
  class_arm_id: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  withdrawn: "Withdrawn",
  transferred: "Transferred",
  graduated: "Graduated",
};

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  withdrawn: "destructive",
  transferred: "outline",
  graduated: "secondary",
};

function RecordsPage() {
  const { settings } = useCollegeSettings();
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState<string | undefined>();

  const { data: students = [] } = useQuery({
    queryKey: ["admission-records-students-list"],
    queryFn: async () =>
      ((await supabase.from("students").select("id, full_name, matric_number, status").order("full_name")).data ??
        []) as StudentListRow[],
  });

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students.slice(0, 20);
    return students
      .filter((s) => s.full_name.toLowerCase().includes(q) || s.matric_number.toLowerCase().includes(q))
      .slice(0, 20);
  }, [students, search]);

  const { data: student } = useQuery({
    queryKey: ["admission-records-student-detail", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select(
          "id, full_name, matric_number, email, gender, date_of_birth, address, guardian_name, guardian_phone, status, admission_date, class_arm_id",
        )
        .eq("id", studentId!)
        .maybeSingle();
      if (error) throw error;
      return data as StudentDetail | null;
    },
  });

  const { data: classArm } = useQuery({
    queryKey: ["admission-records-class-arm", student?.class_arm_id],
    enabled: !!student?.class_arm_id,
    queryFn: async () =>
      (
        await supabase
          .from("class_arms")
          .select("name, departments:department_id(name)")
          .eq("id", student!.class_arm_id!)
          .maybeSingle()
      ).data,
  });
  const departmentName = (classArm?.departments as unknown as { name?: string } | null)?.name ?? "";
  const classLabel = classArm ? `${departmentName} ${classArm.name}`.trim() : "Not yet assigned to a class";

  const admissionDateLabel = student
    ? new Date(student.admission_date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    : "";

  const downloadAdmissionLetter = () => {
    if (!student) return;
    generateAdmissionLetterPdf({
      admission_number: student.matric_number,
      full_name: student.full_name,
      admission_date: student.admission_date,
      class_name: classArm ? classLabel : "the assigned class",
      school: {
        name: settings.college_name,
        short_name: settings.short_name,
        address: settings.address ?? "",
        city: settings.city ?? "",
        state: settings.state ?? "",
        motto: settings.motto ?? "",
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Admission Records</h2>
        <p className="text-sm text-muted-foreground">
          Search for any pupil to see when they were admitted, and re-download their admission letter at any time.
        </p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="text-base">Find a Pupil</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Search by name or admission number</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. Sadiq or PR/26/0091" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Pupil</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder={`${filteredStudents.length} match(es)`} />
              </SelectTrigger>
              <SelectContent>
                {filteredStudents.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.matric_number} — {s.full_name}
                    {s.status !== "active" ? ` (${STATUS_LABEL[s.status] ?? s.status})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!student && (
        <Card className="tsu-shadow">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <UserRound className="h-8 w-8" />
            <p className="text-sm">Search for a pupil above to view their admission record.</p>
          </CardContent>
        </Card>
      )}

      {student && (
        <Card className="tsu-shadow">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{student.full_name}</CardTitle>
                <Badge variant={STATUS_BADGE_VARIANT[student.status] ?? "outline"}>
                  {STATUS_LABEL[student.status] ?? student.status}
                </Badge>
              </div>
              <CardDescription>Admission No: {student.matric_number}</CardDescription>
            </div>
            <Button size="sm" onClick={downloadAdmissionLetter}>
              <Download className="mr-2 h-4 w-4" /> Download Admission Letter
            </Button>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-2">
            <Field label="Admitted into" value={classLabel} />
            <Field label="Date of admission" value={admissionDateLabel} />
            <Field label="Gender" value={student.gender ?? "—"} />
            <Field label="Date of birth" value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "—"} />
            <Field label="Email" value={student.email ?? "—"} />
            <Field label="Home address" value={student.address ?? "—"} />
            <Field label="Guardian name" value={student.guardian_name ?? "—"} />
            <Field label="Guardian phone" value={student.guardian_phone ?? "—"} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p>{value}</p>
    </div>
  );
}
