import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { convertApplicationToStudent } from "@/lib/applicant.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/admin/applications")({
  head: () => ({ meta: [{ title: "Applications — Super Admin" }] }),
  component: () => <ProtectedAdmin><Page /></ProtectedAdmin>,
});

function Page() {
  const { isSuperAdmin, loading } = useRole();
  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin text-primary" />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;
  return <ApplicationsPage />;
}

function ApplicationsPage() {
  const queryClient = useQueryClient();
  const convert = useServerFn(convertApplicationToStudent);
  const applications = useQuery({ queryKey: ["admin-applications"], queryFn: async () => { const { data, error } = await supabase.from("applications").select("id, status, created_at, notes, applicants(applicant_number, full_name, email, phone), programmes(name, code)").order("created_at", { ascending: false }); if (error) throw error; return data ?? []; } });
  const updateStatus = useMutation({ mutationFn: async ({ id, status }: { id: string; status: string }) => { const { error } = await supabase.from("applications").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id); if (error) throw error; }, onSuccess: () => { toast.success("Application updated"); queryClient.invalidateQueries({ queryKey: ["admin-applications"] }); }, onError: (error: Error) => toast.error(error.message) });
  async function admit(id: string) { try { const result = await convert({ data: { application_id: id } }); toast.success(`Student created: ${result.matric_number}. Temporary password: ${result.temporary_password}`); queryClient.invalidateQueries({ queryKey: ["admin-applications"] }); } catch (error) { toast.error((error as Error).message); } }
  return <div className="space-y-6"><div><h2 className="font-serif text-2xl font-bold">Applications</h2><p className="text-sm text-muted-foreground">Review applications submitted through the public admissions form.</p></div><Card><CardHeader><CardTitle className="text-base">Applicant queue</CardTitle></CardHeader><CardContent>{applications.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Applicant</th><th className="py-2 pr-3">Programme</th><th className="py-2 pr-3">Submitted</th><th className="py-2 pr-3">Status</th><th /></tr></thead><tbody>{applications.data?.map((application) => { const applicant = Array.isArray(application.applicants) ? application.applicants[0] : application.applicants; const programme = Array.isArray(application.programmes) ? application.programmes[0] : application.programmes; return <tr key={application.id} className="border-b"><td className="py-3 pr-3"><div className="font-medium">{applicant?.full_name ?? "-"}</div><div className="text-xs text-muted-foreground">{applicant?.applicant_number} · {applicant?.email}</div></td><td className="py-3 pr-3">{programme?.name ?? "-"}</td><td className="py-3 pr-3 text-muted-foreground">{new Date(application.created_at).toLocaleDateString()}</td><td className="py-3 pr-3 capitalize">{application.status.replace("_", " ")}</td><td className="py-3 text-right"><div className="flex justify-end gap-1">{application.status === "submitted" && <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: application.id, status: "under_review" })}>Review</Button>}{application.status !== "admitted" && application.status !== "rejected" && <Button size="sm" onClick={() => admit(application.id)}>Admit</Button>}{application.status !== "rejected" && application.status !== "admitted" && <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: application.id, status: "rejected" })}>Reject</Button>}</div></td></tr>; })}</tbody></table></div>}</CardContent></Card></div>;
}