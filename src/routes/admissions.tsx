import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronDown, ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCollegeSettings } from "@/lib/college-settings";
import { durationLabel, useProgrammes } from "@/lib/public-catalog";
import { useTr } from "@/lib/content-translations";
import { useT, type DictKey } from "@/lib/i18n";

export const Route = createFileRoute("/admissions")({
  head: () => ({
    meta: [
      { title: "Admissions — Apply to the College" },
      {
        name: "description",
        content: "Review admission requirements, programme durations and application information for health technology programmes.",
      },
      { property: "og:title", content: "Admissions — Apply to the College" },
      { property: "og:description", content: "Find admission requirements and programme information for your health technology education." },
    ],
  }),
  component: Admissions,
});

const REQUIREMENTS: DictKey[] = ["admissions.req1", "admissions.req2", "admissions.req3", "admissions.req4"];

const FAQS: { questionKey: DictKey; answerKey: DictKey }[] = [
  { questionKey: "admissions.faq.q1", answerKey: "admissions.faq.a1" },
  { questionKey: "admissions.faq.q2", answerKey: "admissions.faq.a2" },
  { questionKey: "admissions.faq.q3", answerKey: "admissions.faq.a3" },
];

function Admissions() {
  const { settings } = useCollegeSettings();
  const { data: programmes = [], isLoading } = useProgrammes();
  const t = useT();
  const tr = useTr();
  const activeProgrammes = programmes.filter((programme) => programme.is_active);
  const durations = [...new Set(activeProgrammes.map((programme) => programme.duration_years))].sort((a, b) => a - b);

  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">{t("admissions.hero.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-sidebar-foreground/80">
            {t("admissions.hero.tagline")} {settings.college_name} {t("admissions.hero.taglineEnd")}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 md:px-6">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent-foreground">{t("admissions.requirements.kicker")}</p>
            <h2 className="mt-2 font-serif text-2xl font-bold text-foreground md:text-3xl">{t("admissions.requirements.heading")}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t("admissions.requirements.body")}
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {REQUIREMENTS.map((requirement) => (
                <li key={requirement} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {t(requirement)}
                </li>
              ))}
            </ul>
          </div>
          <Card className="border-border tsu-shadow">
            <CardContent className="p-6">
              <h2 className="font-serif text-xl font-bold text-primary">{t("admissions.readyToApply.title")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("admissions.readyToApply.body")}
              </p>
              <Button asChild className="mt-5 w-full">
                <Link to="/apply">{t("admissions.readyToApply.start")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link to="/programmes">{t("admissions.readyToApply.browse")}</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-accent-foreground">{t("admissions.durations.kicker")}</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-foreground md:text-3xl">{t("admissions.durations.heading")}</h2>
            </div>
            {durations.length > 0 && <p className="text-sm text-muted-foreground">{durations.map(durationLabel).join(" / ")}</p>}
          </div>
          {isLoading && <p className="mt-6 text-sm text-muted-foreground">{t("admissions.durations.loading")}</p>}
          {!isLoading && activeProgrammes.length === 0 && <p className="mt-6 text-sm text-muted-foreground">{t("admissions.durations.empty")}</p>}
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeProgrammes.map((programme) => (
              <Card key={programme.id} className="border-border tsu-shadow">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr(programme.award)} · {programme.code}</p>
                  <h3 className="mt-2 font-serif text-lg font-bold text-primary">{tr(programme.name)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{durationLabel(programme.duration_years)}</p>
                  {programme.requirements && <p className="mt-3 text-sm text-muted-foreground">{tr(programme.requirements)}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl font-bold text-foreground md:text-3xl">{t("admissions.faq.heading")}</h2>
          <div className="mt-5 divide-y divide-border border-y border-border">
            {FAQS.map((faq) => (
              <details key={faq.questionKey} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-foreground">
                  {t(faq.questionKey)}
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t(faq.answerKey)}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
