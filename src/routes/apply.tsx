import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, GraduationCap, ArrowRight, ChevronLeft } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSchools, useDepartments } from "@/lib/public-catalog";
import { useCollegeSettings } from "@/lib/college-settings";
import { submitApplication } from "@/lib/applicant.functions";
import { PhotoCaptureInput } from "@/components/PhotoCaptureInput";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

const Search = z.object({ class: z.string().uuid().optional() });

export const Route = createFileRoute("/apply")({
  head: () => ({
    meta: [
      { title: "Apply for Admission — School Portal" },
      { name: "description", content: "Apply for your child's admission into a class at our school." },
    ],
  }),
  validateSearch: (s) => Search.parse(s),
  component: ApplyPage,
});

// A distinct accent color per section card, cycled — keeps the chooser from
// looking like a single generic template while staying on-brand.
const CARD_ACCENTS = [
  "bg-primary text-primary-foreground hover:bg-primary/90",
  "bg-accent text-accent-foreground hover:bg-accent/90",
  "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
  "bg-foreground text-background hover:bg-foreground/90",
];

function ApplyPage() {
  const { class: classParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/apply" });
  const { settings, isLoading: settingsLoading } = useCollegeSettings();
  const t = useT();

  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">{t("apply.hero.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-sidebar-foreground/80">
            {t("apply.hero.tagline")}
          </p>
        </div>
      </div>

      {settingsLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !settings.admissions_open ? (
        <div className="mx-auto max-w-2xl px-4 py-12 md:px-6">
          <Card className="tsu-shadow border-dashed">
            <CardContent className="space-y-2 py-12 text-center">
              <h2 className="font-serif text-xl font-bold">{t("apply.closed.title")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("apply.closed.body")}
              </p>
              <Button asChild variant="outline" className="mt-2">
                <Link to="/">{t("apply.returnHome")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : classParam ? (
        <ApplicationForm departmentId={classParam} onChangeClass={() => navigate({ search: {} })} />
      ) : (
        <ClassChooser onSelect={(id) => navigate({ search: { class: id } })} />
      )}
    </PublicLayout>
  );
}

function ClassChooser({ onSelect }: { onSelect: (departmentId: string) => void }) {
  const { data: sections = [], isLoading: sectionsLoading } = useSchools();
  const { data: classes = [], isLoading: classesLoading } = useDepartments();
  const isLoading = sectionsLoading || classesLoading;
  const activeSections = sections.filter((s) => s.is_active);
  const t = useT();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <p className="text-sm text-muted-foreground">
        {t("apply.chooser.tagline")}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {activeSections.map((section) => {
            const sectionClasses = classes.filter((c) => c.faculty_id === section.id && c.is_active);
            if (sectionClasses.length === 0) return null;
            return (
              <div key={section.id}>
                <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-foreground">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  {section.name}
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {sectionClasses.map((cls, i) => (
                    <button
                      key={cls.id}
                      onClick={() => onSelect(cls.id)}
                      className={`flex items-center justify-between rounded-lg px-5 py-4 text-left text-sm font-semibold shadow-sm transition-colors ${CARD_ACCENTS[i % CARD_ACCENTS.length]}`}
                    >
                      <span>{cls.name}</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {activeSections.every((s) => classes.filter((c) => c.faculty_id === s.id && c.is_active).length === 0) && (
            <Card className="tsu-shadow border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {t("apply.chooser.noneOpen")}{" "}
                <Link to="/news" className="font-medium text-primary hover:underline">
                  {t("apply.chooser.newsAndEvents")}
                </Link>{" "}
                {t("apply.chooser.forIntake")}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ApplicationForm({
  departmentId,
  onChangeClass,
}: {
  departmentId: string;
  onChangeClass: () => void;
}) {
  const { data: classes = [] } = useDepartments();
  const cls = classes.find((c) => c.id === departmentId);
  const submit = useServerFn(submitApplication);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const t = useT();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo) {
      toast.error("Please add the pupil's passport photograph before submitting.");
      return;
    }
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
          guardian_name: String(form.get("guardian_name") || ""),
          guardian_phone: String(form.get("guardian_phone") || ""),
          previous_school: String(form.get("previous_school") || ""),
          department_id: departmentId,
          photo_base64: photo,
        },
      });
      setSuccess(result.applicant_number);
      event.currentTarget.reset();
      setPhoto(null);
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
            <h2 className="font-serif text-2xl font-bold">{t("apply.success.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("apply.success.bodyStart")} <strong className="text-foreground">{success}</strong>.{" "}
              {t("apply.success.bodyEnd")}
            </p>
            <div className="flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link to="/">{t("apply.returnHome")}</Link>
              </Button>
              <Button onClick={onChangeClass}>{t("apply.success.applyAnother")}</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <button
            onClick={onChangeClass}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ChevronLeft className="h-4 w-4" /> {t("apply.form.chooseDifferent")}
          </button>
          <Card className="tsu-shadow">
            <CardHeader>
              <CardTitle className="font-serif text-2xl">{t("apply.form.heading")}</CardTitle>
              {cls && (
                <p className="text-sm text-muted-foreground">
                  {t("apply.form.applyingFor")} <strong className="text-foreground">{cls.name}</strong>
                </p>
              )}
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
                <div className="md:col-span-2">
                  <PhotoCaptureInput label={t("apply.form.pupilPhoto")} value={photo} onChange={setPhoto} required disabled={submitting} />
                </div>
                <Field label={t("apply.form.pupilFullName")} name="full_name" required />
                <Field label={t("apply.form.dateOfBirth")} name="date_of_birth" type="date" />
                <label className="space-y-1.5 text-sm font-medium">
                  <Label>{t("apply.form.gender")}</Label>
                  <select name="gender" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">{t("apply.form.selectGender")}</option>
                    <option>{t("apply.form.female")}</option>
                    <option>{t("apply.form.male")}</option>
                  </select>
                </label>
                <Field label={t("apply.form.previousSchool")} name="previous_school" />
                <Field label={t("apply.form.guardianName")} name="guardian_name" required />
                <Field label={t("apply.form.guardianPhone")} name="phone" type="tel" required />
                <Field label={t("apply.form.guardianEmail")} name="email" type="email" required />
                <Field label={t("apply.form.stateOfOrigin")} name="state_of_origin" />
                <label className="space-y-1.5 text-sm font-medium md:col-span-2">
                  <Label>{t("apply.form.homeAddress")}</Label>
                  <Textarea name="address" rows={3} />
                </label>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("apply.form.submit")}
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
