import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProgrammes, durationLabel } from "@/lib/public-catalog";
import { submitApplication } from "@/lib/applicant.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/apply")({
  head: () => ({ meta: [{ title: "Apply for Admission — Kazaure College" }] }),
  component: ApplyPage,
});

function ApplyPage() {
  const { data: programmes = [], isLoading } = useProgrammes();
  const submit = useServerFn(submitApplication);
  const [programmeId, setProgrammeId] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const result = await submit({ data: {
        full_name: String(form.get("full_name")), email: String(form.get("email")), phone: String(form.get("phone") || ""),
        gender: String(form.get("gender") || ""), date_of_birth: String(form.get("date_of_birth") || ""), address: String(form.get("address") || ""),
        state_of_origin: String(form.get("state_of_origin") || ""), qualification: String(form.get("qualification") || ""), programme_id: programmeId,
      } });
      setSuccess(result.applicant_number);
      event.currentTarget.reset();
    } catch (error) { toast.error((error as Error).message); } finally { setSubmitting(false); }
  }

  return <PublicLayout><div className="tsu-header-grad py-12 text-primary-foreground"><div className="mx-auto max-w-7xl px-4 md:px-6"><h1 className="font-serif text-3xl font-bold md:text-4xl">Apply for Admission</h1><p className="mt-2 text-sm text-primary-foreground/80">Submit your details for review by the admissions office.</p></div></div><div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
    {success ? <Card className="tsu-shadow"><CardContent className="space-y-4 p-8 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-primary" /><h2 className="font-serif text-2xl font-bold">Application received</h2><p className="text-sm text-muted-foreground">Your applicant number is <strong className="text-foreground">{success}</strong>. Keep it for future enquiries.</p><Button asChild><Link to="/">Return home</Link></Button></CardContent></Card> : <Card className="tsu-shadow"><CardHeader><CardTitle className="font-serif text-2xl">Applicant details</CardTitle></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
      <Field label="Full name" name="full_name" required /><Field label="Email" name="email" type="email" required /><Field label="Phone" name="phone" type="tel" /><Field label="Date of birth" name="date_of_birth" type="date" /><Field label="State of origin" name="state_of_origin" /><Field label="Highest qualification" name="qualification" /><label className="space-y-1.5 text-sm font-medium"><Label>Gender</Label><select name="gender" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Select gender</option><option>Female</option><option>Male</option><option>Other</option></select></label><label className="space-y-1.5 text-sm font-medium"><Label>Programme</Label><select required value={programmeId} onChange={(event) => setProgrammeId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">{isLoading ? "Loading programmes..." : "Select programme"}</option>{programmes.filter((programme) => programme.is_active).map((programme) => <option key={programme.id} value={programme.id}>{programme.name} ({durationLabel(programme.duration_years)})</option>)}</select></label><label className="space-y-1.5 text-sm font-medium md:col-span-2"><Label>Address</Label><Textarea name="address" rows={3} /></label><div className="md:col-span-2"><Button type="submit" disabled={submitting || !programmeId}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit application</Button></div>
    </form></CardContent></Card>}
  </div></PublicLayout>;
}

function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) { return <label className="space-y-1.5 text-sm font-medium"><Label>{label}</Label><Input name={name} type={type} required={required} /></label>; }
