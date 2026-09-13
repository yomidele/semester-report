import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedAdmissionOfficer } from "@/components/ProtectedAdmissionOfficer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus } from "lucide-react";

export const Route = createFileRoute("/admission-officer/dashboard")({
  head: () => ({ meta: [{ title: "Admission Officer Dashboard — School Portal" }] }),
  component: () => <ProtectedAdmissionOfficer><Page /></ProtectedAdmissionOfficer>,
});

function Page() {
  const totalStudents = useQuery({
    queryKey: ["ao-students-count"],
    queryFn: async () => (await supabase.from("students").select("*", { count: "exact", head: true })).count ?? 0,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Admission Officer</h2>
        <p className="text-sm text-muted-foreground">Enrol new pupils and issue their admission letters.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="tsu-shadow">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <Users className="h-5 w-5 text-primary" />
              <p className="mt-2 text-2xl font-bold">{totalStudents.data ?? "—"}</p>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Enrolled pupils</p>
            </div>
          </CardContent>
        </Card>
        <Card className="tsu-shadow">
          <CardContent className="flex flex-col items-start gap-3 p-4">
            <UserPlus className="h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">Ready to admit a new pupil? Enter their details and an admission letter is generated instantly.</p>
            <Link to="/admission-officer/enroll"><Button size="sm">Enrol a pupil</Button></Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
