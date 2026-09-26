import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedExamOfficer } from "@/components/ProtectedExamOfficer";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, FileText, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/exam-officer/dashboard")({
  head: () => ({ meta: [{ title: "Exam Officer Dashboard — School Portal" }] }),
  component: () => <ProtectedExamOfficer><Page /></ProtectedExamOfficer>,
});

function Page() {
  const sessionsCount = useQuery({
    queryKey: ["eo-sessions-count"],
    queryFn: async () => (await supabase.from("academic_sessions").select("*", { count: "exact", head: true })).count ?? 0,
  });
  const pending = useQuery({
    queryKey: ["eo-pending-count"],
    queryFn: async () => (await supabase.from("results").select("*", { count: "exact", head: true }).eq("status", "submitted")).count ?? 0,
  });

  const stats = [
    { label: "Sessions / Terms", value: sessionsCount.data, icon: CalendarDays, to: "/sessions" as const },
    { label: "Results to Review", value: pending.data, icon: ClipboardCheck, to: "/exam-officer/results" as const },
    { label: "Approved Results", value: undefined, icon: ClipboardCheck, to: "/exam-officer/results" as const },
    { label: "Report Sheets", value: undefined, icon: FileText, to: "/exam-officer/report-sheets" as const },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Exam Officer</h2>
        <p className="text-sm text-muted-foreground">Manage examination sessions and terms, review and finalize submitted results, and generate report sheets.</p>
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
    </div>
  );
}
