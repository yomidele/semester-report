import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, BookOpen, Users, ClipboardList, TrendingUp, CheckCircle2, Circle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/use-role";
import { getPromotionOverview } from "@/lib/promotion.functions";
import { AdmissionsToggle } from "@/components/AdmissionsToggle";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — School Portal Result Portal" }] }),
  component: () => <ProtectedAdmin><DashboardPage /></ProtectedAdmin>,
});

function useCount(table: "academic_sessions" | "courses" | "students" | "results") {
  return useQuery({
    queryKey: ["count", table],
    queryFn: async () => {
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function DashboardPage() {
  const sessions = useCount("academic_sessions");
  const subjects = useCount("courses");
  const students = useCount("students");
  const results = useCount("results");

  const stats = [
    { label: "Academic Sessions", value: sessions.data, icon: CalendarDays, to: "/sessions" },
    { label: "Subjects", value: subjects.data, icon: BookOpen, to: "/courses" },
    { label: "Students", value: students.data, icon: Users, to: "/students" },
    { label: "Results Recorded", value: results.data, icon: ClipboardList, to: "/results" },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-foreground">Welcome, Administrator</h2>
        <p className="text-sm text-muted-foreground">Overview of the result management system.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, to }) => (
          <Link to={to} key={label}>
            <Card className="tsu-shadow transition-colors hover:border-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold text-foreground">{value ?? "—"}</span>
                </div>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <PromotionSummary />

      <AdmissionsToggle />

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Getting started</CardTitle>
          <CardDescription>Follow these steps to demo the full result lifecycle.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
            <li>Create an <Link to="/sessions" className="font-medium text-primary underline">Academic Session</Link> (e.g. 2024/2025).</li>
            <li>Add <Link to="/courses" className="font-medium text-primary underline">Subjects</Link> for each level and semester.</li>
            <li>Register <Link to="/students" className="font-medium text-primary underline">Students</Link> with matric numbers.</li>
            <li>Use <Link to="/result-entry" className="font-medium text-primary underline">Result Entry</Link> to record CA &amp; Exam scores.</li>
            <li>View, print, or export the result sheet from <Link to="/results" className="font-medium text-primary underline">View / Export Results</Link>.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

// Student Promotion at a glance (Super Admin only): where the current
// session is in its three terms, and a way into the full promotion screen.
function PromotionSummary() {
  const { isSuperAdmin } = useRole();
  const fetchOverview = useServerFn(getPromotionOverview);
  const overview = useQuery({
    queryKey: ["promotion-overview", null],
    enabled: isSuperAdmin,
    retry: false,
    queryFn: () => fetchOverview({ data: { from_session_id: null } }),
  });
  if (!isSuperAdmin) return null;

  const sessions = overview.data?.sessions ?? [];
  const current = sessions.find((s) => !s.closed_at);
  const lastClosed = sessions.find((s) => s.closed_at);
  const steps = current
    ? [
        { label: "First Term", done: !!current.first_term_completed_at },
        { label: "Second Term", done: !!current.second_term_completed_at },
        { label: "Third Term", done: !!current.third_term_completed_at },
      ]
    : [];

  return (
    <Card className="tsu-shadow">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 font-serif text-lg"><TrendingUp className="h-5 w-5 text-primary" /> Student Promotion</CardTitle>
          <CardDescription>Pupils move up a class after all three terms are complete and the session is closed.</CardDescription>
        </div>
        <Button asChild className="h-10 shrink-0"><Link to="/admin/promotions">Open Student Promotion</Link></Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {overview.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {overview.error && <p className="text-destructive">{(overview.error as Error).message}</p>}
        {overview.data && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Current session</p><p className="font-semibold">{current?.name ?? "—"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Last closed session</p><p className="font-semibold">{lastClosed?.name ?? "None yet"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Pupils enrolled</p><p className="font-semibold">{overview.data.activeCount}</p></div>
            </div>
            {current && (
              <ol className="flex flex-wrap gap-2">
                {steps.map((st) => (
                  <li key={st.label} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${st.done ? "border-success/40 bg-success/10" : "border-border text-muted-foreground"}`}>
                    {st.done ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Circle className="h-3.5 w-3.5" />}{st.label}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
