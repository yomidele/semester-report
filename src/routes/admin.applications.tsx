import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ProtectedAdmissionOfficer } from "@/components/ProtectedAdmissionOfficer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { updateApplicationStatus } from "@/lib/applicant.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/applications")({
  head: () => ({ meta: [{ title: "Applications — Admission Officer" }] }),
  component: () => (
    <ProtectedAdmissionOfficer>
      <Page />
    </ProtectedAdmissionOfficer>
  ),
});

function Page() {
  const { isSuperAdmin, isAdmissionOfficer, loading } = useRole();
  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin text-primary" />;
  if (!isSuperAdmin && !isAdmissionOfficer) return <Navigate to="/dashboard" />;
  return <ApplicationsPage />;
}

function ApplicationsPage() {
  const queryClient = useQueryClient();
  const setStatus = useServerFn(updateApplicationStatus);

  const applications = useQuery({
    queryKey: ["admin-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, status, created_at, notes, applicants(applicant_number, full_name, email, phone, guardian_name, photo_url), departments(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "under_review" | "rejected" }) =>
      setStatus({ data: { application_id: id, status } }),
    onSuccess: () => {
      toast.success("Application updated");
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Applications</h2>
        <p className="text-sm text-muted-foreground">
          Review applications submitted through the public admissions form on the homepage.
          Admitting a pupil takes you to the enrolment form with their details already filled in.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Applicant queue</CardTitle>
        </CardHeader>
        <CardContent>
          {applications.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : applications.data?.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No applications yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Applicant</th>
                    <th className="py-2 pr-3">Guardian</th>
                    <th className="py-2 pr-3">Class applied for</th>
                    <th className="py-2 pr-3">Submitted</th>
                    <th className="py-2 pr-3">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {applications.data?.map((application) => {
                    const applicant = Array.isArray(application.applicants) ? application.applicants[0] : application.applicants;
                    const cls = Array.isArray(application.departments) ? application.departments[0] : application.departments;
                    return (
                      <tr key={application.id} className="border-b">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            {applicant?.photo_url ? (
                              <img src={applicant.photo_url} alt="" className="h-9 w-9 shrink-0 rounded-md border border-border object-cover" />
                            ) : (
                              <div className="h-9 w-9 shrink-0 rounded-md border border-dashed border-border" />
                            )}
                            <div>
                              <div className="font-medium">{applicant?.full_name ?? "-"}</div>
                              <div className="text-xs text-muted-foreground">{applicant?.applicant_number}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <div>{applicant?.guardian_name ?? "-"}</div>
                          <div className="text-xs text-muted-foreground">{applicant?.phone ?? applicant?.email}</div>
                        </td>
                        <td className="py-3 pr-3">{cls?.name ?? "-"}</td>
                        <td className="py-3 pr-3 text-muted-foreground">{new Date(application.created_at).toLocaleDateString()}</td>
                        <td className="py-3 pr-3 capitalize">{application.status.replace("_", " ")}</td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-1">
                            {application.status === "submitted" && (
                              <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: application.id, status: "under_review" })}>
                                Review
                              </Button>
                            )}
                            {application.status !== "admitted" && application.status !== "rejected" && (
                              <Button size="sm" asChild>
                                <Link to="/admission-officer/enroll" search={{ application_id: application.id }}>
                                  Admit
                                </Link>
                              </Button>
                            )}
                            {application.status !== "rejected" && application.status !== "admitted" && (
                              <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: application.id, status: "rejected" })}>
                                Reject
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
