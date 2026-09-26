import { createFileRoute } from "@tanstack/react-router";
import { ProtectedTeacher } from "@/components/ProtectedTeacher";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/lecturer/class")({
  validateSearch: (search: Record<string, unknown>) => ({ class_arm_id: typeof search.class_arm_id === "string" ? search.class_arm_id : "" }),
  head: () => ({ meta: [{ title: "My Form Class — Teacher Portal" }] }),
  component: () => <ProtectedTeacher><Page /></ProtectedTeacher>,
});

function Page() {
  const { class_arm_id } = Route.useSearch();
  const { session } = useAuthSession();
  const { isSuperAdmin, formMasterAssignments } = useRole();
  const classArm = useQuery({
    queryKey: ["form-master-class", class_arm_id, session?.user.id],
    enabled: Boolean(class_arm_id && session),
    queryFn: async () => {
      const { data: teacher, error: teacherError } = await supabase.from("lecturers").select("id").eq("user_id", session!.user.id).maybeSingle();
      if (teacherError) throw teacherError;
      if (!teacher) throw new Error("Teacher profile not found");
      if (!isSuperAdmin && !formMasterAssignments.some((assignment) => assignment.id === class_arm_id)) throw new Error("This class is not assigned to you as Form Master");
      const { data, error } = await supabase.from("class_arms").select("id, name, department_id, departments(name)").eq("id", class_arm_id).eq("form_teacher_id", teacher.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const students = useQuery({
    queryKey: ["form-class-students", class_arm_id],
    enabled: Boolean(classArm.data),
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, full_name, matric_number").eq("class_arm_id", class_arm_id).order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const results = useQuery({
    queryKey: ["form-class-results", class_arm_id, students.data?.map((student) => student.id)],
    enabled: Boolean(students.data?.length),
    queryFn: async () => {
      const { data, error } = await supabase.from("results").select("id, student_id, total_score, status, semester, session_id, students(full_name), courses(title, code), academic_sessions(name)").in("student_id", (students.data ?? []).map((student) => student.id)).order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!class_arm_id) return <p className="p-6 text-sm text-muted-foreground">Select an assigned class from your dashboard.</p>;
  if (classArm.isLoading) return <Loader2 className="m-8 h-6 w-6 animate-spin text-primary" />;
  if (classArm.error || !classArm.data) return <p className="p-6 text-sm text-destructive">{classArm.error instanceof Error ? classArm.error.message : "Class assignment not found."}</p>;

  return <div className="space-y-6">
    <div><h1 className="font-serif text-2xl font-bold">{(classArm.data.departments as { name?: string } | null)?.name} {classArm.data.name}</h1><p className="text-sm text-muted-foreground">Your Form Master class · {students.data?.length ?? 0} pupils</p></div>
    <Card><CardHeader><CardTitle className="text-base">Class roster</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Pupil</th><th>Admission number</th></tr></thead><tbody>{(students.data ?? []).map((student) => <tr key={student.id} className="border-b"><td className="py-2">{student.full_name}</td><td>{student.matric_number ?? "—"}</td></tr>)}</tbody></table>{students.data?.length === 0 && <p className="py-4 text-muted-foreground">No pupils are assigned to this class yet.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Academic performance</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Pupil</th><th>Subject</th><th>Term</th><th>Session</th><th>Score</th><th>Status</th></tr></thead><tbody>{(results.data ?? []).map((result: any) => <tr key={result.id} className="border-b"><td className="py-2">{result.students?.full_name ?? "—"}</td><td>{result.courses?.title ?? result.courses?.code ?? "—"}</td><td>{result.semester}</td><td>{result.academic_sessions?.name ?? "—"}</td><td>{result.total_score ?? "—"}</td><td className="capitalize">{result.status}</td></tr>)}</tbody></table>{results.data?.length === 0 && <p className="py-4 text-muted-foreground">No academic results are available for this class yet.</p>}</CardContent></Card>
  </div>;
}
