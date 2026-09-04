import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, GraduationCap, ArrowRight, ChevronLeft } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSchools, useProgrammes, durationLabel } from "@/lib/public-catalog";
import { submitApplication } from "@/lib/applicant.functions";
import { toast } from "sonner";

const Search = z.object({ programme: z.string().uuid().optional() });

export const Route = createFileRoute("/apply")({
  head: () => ({
    meta: [
      { title: "Apply for Admission — Kazaure College" },
      { name: "description", content: "Choose a programme and submit your application to Kazaure College of Health Technology." },
    ],
  }),
  validateSearch: (s) => Search.parse(s),
  component: ApplyPage,
});

// A distinct accent color per school card, cycled — keeps the chooser from
// looking like a single generic template while staying on-brand.
const CARD_ACCENTS = [
  "bg-primary text-primary-foreground hover:bg-primary/90",
  "bg-accent text-accent-foreground hover:bg-accent/90",
  "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
  "bg-foreground text-background hover:bg-foreground/90",
];

function ApplyPage() {
  const { programme: programmeParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/apply" });

  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">Apply for Admission</h1>
          <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">
            Choose the programme you want to apply for, then complete the applicant form below.
          </p>
        </div>
      </div>

      {programmeParam ? (
        <ApplicationForm
          programmeId={programmeParam}
          onChangeProgramme={() => navigate({ search: {} })}
        />
      ) : (
        <ProgrammeChooser
          onSelect={(id) => navigate({ search: { programme: id } })}
        />
      )}
    </PublicLayout>
  );
}

function ProgrammeChooser({ onSelect }: { onSelect: (programmeId: string) => void }) {
  const { data: schools = [], isLoading: schoolsLoading } = useSchools();
  const { data: programmes = [], isLoading: programmesLoading } = useProgrammes();
  const isLoading = schoolsLoading || programmesLoading;
  const activeSchools = schools.filter((s) => s.is_active);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <p className="text-sm text-muted-foreground">
        Select the school and programme you're applying to. You'll fill out one application
        form — admission requirements vary slightly by programme, so pick carefully.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {activeSchools.map((school) => {
            const schoolProgrammes = programmes.filter(
              (p) => p.faculty_id === school.id && p.is_active,
            );
            if (schoolProgrammes.length === 0) return null;
            return (
              <div key={school.id}>
                <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-foreground">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  {school.name}
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {schoolProgrammes.map((programme, i) => (
                    <button
                      key={programme.id}
                      onClick={() => onSelect(programme.id)}
                      className={`flex items-center justify-between rounded-lg px-5 py-4 text-left text-sm font-semibold shadow-sm transition-colors ${CARD_ACCENTS[i % CARD_ACCENTS.length]}`}
                    >
                      <span>
                        {programme.name}
                        <span className="mt-0.5 block text-xs font-normal opacity-80">
                          {programme.award} · {durationLabel(programme.duration_years)}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {activeSchools.every(
            (s) => programmes.filter((p) => p.faculty_id === s.id && p.is_active).length === 0,
          ) && (
            <Card className="tsu-shadow border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Admissions aren't open for any programme right now. Check the{" "}
                <Link to="/news" className="font-medium text-primary hover:underline">
                  News &amp; Events
                </Link>{" "}
                page for the next intake announcement.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ApplicationForm({
  programmeId,
  onChangeProgramme,
}: {
  programmeId: string;
  onChangeProgramme: () => void;
}) {
  const { data: programmes = [] } = useProgrammes();
  const programme = programmes.find((p) => p.id === programmeId);
  const submit = useServerFn(submitApplication);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const result = await submit({
        data: {
          full_name: String(form.get("full_name")),
          email: String(form.get("email")),
          phone: String(form.get("phone") || ""),
          gender: String(form.get("gender") || ""),
          date_of_birth: String(form.get("date_of_birth") || ""),
          address: String(form.get("address") || ""),
          state_of_origin: String(form.get("state_of_origin") || ""),
          qualification: String(form.get("qualification") || ""),
          programme_id: programmeId,
        },
      });
      setSuccess(result.applicant_number);
      event.currentTarget.reset();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      {success ? (
        <Card className="tsu-shadow">
          <CardContent className="space-y-4 p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h2 className="font-serif text-2xl font-bold">Application received</h2>
            <p className="text-sm text-muted-foreground">
              Your applicant number is <strong className="text-foreground">{success}</strong>.
              Keep it for future enquiries — you'll need it to check your application status.
            </p>
            <div className="flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link to="/">Return home</Link>
              </Button>
              <Button onClick={onChangeProgramme}>Apply for another programme</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <button
            onClick={onChangeProgramme}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ChevronLeft className="h-4 w-4" /> Choose a different programme
          </button>
          <Card className="tsu-shadow">
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Applicant details</CardTitle>
              {programme && (
                <p className="text-sm text-muted-foreground">
                  Applying for <strong className="text-foreground">{programme.name}</strong> (
                  {programme.award}, {durationLabel(programme.duration_years)})
                </p>
              )}
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
                <Field label="Full name" name="full_name" required />
                <Field label="Email" name="email" type="email" required />
                <Field label="Phone" name="phone" type="tel" />
                <Field label="Date of birth" name="date_of_birth" type="date" />
                <Field label="State of origin" name="state_of_origin" />
                <Field label="Highest qualification" name="qualification" />
                <label className="space-y-1.5 text-sm font-medium">
                  <Label>Gender</Label>
                  <select
                    name="gender"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select gender</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-sm font-medium md:col-span-2">
                  <Label>Address</Label>
                  <Textarea name="address" rows={3} />
                </label>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit application
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      <Label>{label}</Label>
      <Input name={name} type={type} required={required} />
    </label>
  );
}
