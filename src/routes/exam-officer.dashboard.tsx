import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedExamOfficer } from "@/components/ProtectedExamOfficer";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { School, Users, LinkIcon, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/exam-officer/dashboard")({
  head: () => ({ meta: [{ title: "Exam Officer Dashboard — School Portal" }] }),
  component: () => <ProtectedExamOfficer><Page /></ProtectedExamOfficer>,
});

function Page() {
  const classesCount = useQuery({
    queryKey: ["eo-classes-count"],
    queryFn: async () => (await supabase.from("departments").select("*", { count: "exact", head: true })).count ?? 0,
  });
  const armsCount = useQuery({
    queryKey: ["eo-arms-count"],
    queryFn: async () => (await supabase.from("class_arms").select("*", { count: "exact", head: true })).count ?? 0,
  });
  const teachersCount = useQuery({
    queryKey: ["eo-teachers-count"],
    queryFn: async () => (await supabase.from("lecturers").select("*", { count: "exact", head: true })).count ?? 0,
  });
  const pending = useQuery({
    queryKey: ["eo-pending-count"],
    queryFn: async () => (await supabase.from("results").select("*", { count: "exact", head: true }).eq("status", "submitted")).count ?? 0,
  });

  const stats = [
    { label: "Classes", value: classesCount.data, icon: School, to: "/exam-officer/classes" as const },
    { label: "Class Arms", value: armsCount.data, icon: School, to: "/exam-officer/classes" as const },
    { label: "Teachers", value: teachersCount.data, icon: Users, to: "/exam-officer/assignments" as const },
    { label: "Pending Results", value: pending.data, icon: ClipboardCheck, to: "/exam-officer/report-sheets" as const },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Exam Officer</h2>
        <p className="text-sm text-muted-foreground">Manage classes and arms, assign teachers school-wide, and compile report sheets.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, to }) => (
          <Link key={label} to={to}>
            <Card className="tsu-shadow transition-colors hover:border-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{value ?? "—"}</span>
                </div>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <LinkIcon className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Adding a new class level or arm? Head to{" "}
          <Link to="/exam-officer/classes" className="font-medium text-primary hover:underline">Classes &amp; Arms</Link>.
        </p>
      </div>
    </div>
  );
}
