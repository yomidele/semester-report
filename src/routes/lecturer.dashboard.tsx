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
               .select("id, semester, course_id, session_id, courses(code, title, level, unit), academic_sessions(name)")
        .eq("lecturer_id", teacher.data!.id);
      return data ?? [];
    },
  });
  const formClasses = useQuery({
    queryKey: ["form-master-classes", teacher.data?.id], enabled: !!teacher.data,
    queryFn: async () => {
      const { data } = await supabase.from("class_arms").select("id, name").eq("form_teacher_id", teacher.data!.id);
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
        <Link to="/lecturer/attendance">
          <Card className="tsu-shadow border-primary/40 transition-colors hover:border-primary">
            <CardHeader><CardTitle className="text-base">Take attendance — {(formClasses.data ?? []).map((c: any) => c.name).join(", ")}</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              You're the form master here. Mark today's attendance — works offline too.
            </CardContent>
          </Card>
        </Link>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {(assignments.data ?? []).map((a: any) => (
           <Link key={a.id} to="/lecturer/entry" search={{ assignment_id: a.id }}>
            <Card className="tsu-shadow transition-colors hover:border-primary">
              <CardHeader><CardTitle className="text-base">{a.courses?.code} — {a.courses?.title}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Level {a.courses?.level} · {a.semester} Term · {a.courses?.unit} units · {a.academic_sessions?.name}
              </CardContent>
            </Card>
          </Link>
        ))}
        {(assignments.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No subjects assigned yet. Contact your Class Admin.</p>}
      </div>
    </div>
  );
}
