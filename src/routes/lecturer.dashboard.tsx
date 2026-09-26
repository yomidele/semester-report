import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedTeacher } from "@/components/ProtectedTeacher";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/lecturer/dashboard")({
  head: () => ({ meta: [{ title: "Teacher Dashboard — School Portal" }] }),
  component: () => <ProtectedTeacher><Page /></ProtectedTeacher>,
});

function Page() {
  const { session } = useAuthSession();
  const teacher = useQuery({
    queryKey: ["teacher-self", session?.user.id], enabled: !!session,
    queryFn: async () => (await supabase.from("lecturers").select("id, full_name").eq("user_id", session!.user.id).maybeSingle()).data,
  });
  const assignments = useQuery({
    queryKey: ["teacher-assignments", teacher.data?.id], enabled: !!teacher.data,
    queryFn: async () => {
      const { data } = await supabase.from("course_assignments")
               .select("id, semester, course_id, session_id, department_id, class_arm_id, courses(code, title, level, unit), academic_sessions(name), departments:department_id(name), class_arms:class_arm_id(name)")
        .eq("lecturer_id", teacher.data!.id);
      return data ?? [];
    },
  });
  const formClasses = useQuery({
    queryKey: ["form-master-classes", teacher.data?.id], enabled: !!teacher.data,
    queryFn: async () => (await supabase.from("class_arms").select("id, name, department_id, departments(name)").eq("form_teacher_id", teacher.data!.id)).data ?? [],
  });
  const formMasterResults = useQuery({
    queryKey: ["form-master-results", teacher.data?.id, formClasses.data?.map((item) => item.id)],
    enabled: !!teacher.data && Boolean(formClasses.data?.length),
    queryFn: async () => {
      const departmentIds = Array.from(new Set((formClasses.data ?? []).map((item) => item.department_id)));
      const { data: students, error: studentsError } = await supabase.from("students").select("id").in("department_id", departmentIds);
      if (studentsError) throw studentsError;
      const studentIds = (students ?? []).map((item) => item.id);
      if (!studentIds.length) return [];
      const { data, error } = await supabase.from("results").select("id, status, total_score, student_id").in("student_id", studentIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Welcome{teacher.data ? `, ${teacher.data.full_name}` : ""}</h2>
        <p className="text-sm text-muted-foreground">Subjects assigned to you. Click one to enter scores.</p>
      </div>
      {(formClasses.data ?? []).length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {(formClasses.data ?? []).map((classArm: any) => (
            <Card key={classArm.id} className="tsu-shadow border-primary/40">
              <CardHeader><CardTitle className="text-base">Form Master — {classArm.departments?.name} {classArm.name}</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Monitor this assigned class, its pupils, attendance, and academic performance.</p>
                <div className="flex flex-wrap gap-2">
                  <Link className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground" to="/lecturer/attendance">Take attendance</Link>
                  <Link className="rounded-md border border-border px-3 py-2 font-medium text-foreground" to="/lecturer/class" search={{ class_arm_id: classArm.id }}>View class</Link>
                </div>
                <p>{(formMasterResults.data ?? []).length} result records across assigned class(es)</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {(assignments.data ?? []).map((a: any) => {
          // A null class_arm_id means the assignment covers every arm of the
          // class (see lecturer.entry.tsx), so label it as such rather than
          // implying a single arm.
          const className = a.departments?.name
            ? a.class_arms?.name
              ? `${a.departments.name} ${a.class_arms.name}`
              : `${a.departments.name} — All arms`
            : null;
          return (
            <Link key={a.id} to="/lecturer/entry" search={{ assignment_id: a.id }}>
              <Card className="tsu-shadow transition-colors hover:border-primary">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-base">{a.courses?.code} — {a.courses?.title}</CardTitle>
                  {className && <p className="text-sm font-medium text-primary">{className}</p>}
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {a.semester} Term · {a.academic_sessions?.name}
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {(assignments.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No subjects assigned yet. Contact the Super Admin.</p>}
      </div>
    </div>
  );
}
