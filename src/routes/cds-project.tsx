import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useCollegeSettings } from "@/lib/college-settings";
import { Code2, MapPin, IdCard, School, CalendarDays } from "lucide-react";
import { useT, type DictKey } from "@/lib/i18n";
import developerPortrait from "@/assets/nysc-developer-portrait.png";

export const Route = createFileRoute("/cds-project")({
  head: () => ({
    meta: [
      { title: "NYSC Personal CDS Project — Model Day Primary School Kazaure" },
      {
        name: "description",
        content: "The NYSC Personal Community Development Service (CDS) project behind this School Management System, developed by Garba Sadiq Suleman for Model Day Primary School Kazaure.",
      },
      { property: "og:title", content: "NYSC Personal CDS Project" },
      { property: "og:description", content: "School Management System — an NYSC Personal CDS project developed for Model Day Primary School Kazaure." },
    ],
  }),
  component: CdsProject,
});

// Names, the PPA and the state code are proper nouns/identifiers and are shown as-is
// in both languages; only the labels (and descriptive values) are translated.
const PROJECT_INFO: { labelKey: DictKey; valueKey?: DictKey; value?: string }[] = [
  { labelKey: "cds.info.project", valueKey: "cds.info.projectValue" },
  { labelKey: "cds.info.projectType", valueKey: "cds.info.projectTypeValue" },
  { labelKey: "cds.info.developer", value: "Garba Sadiq Suleman" },
  { labelKey: "cds.label.ppa", value: "Model Day Primary School Kazaure" },
  { labelKey: "cds.label.location", value: "Sha'iskawa, Kazaure, Jigawa State" },
  { labelKey: "cds.label.serviceYear", value: "Batch A2 2026" },
];

function CdsProject() {
  const { settings } = useCollegeSettings();
  const t = useT();

  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t("cds.hero.kicker")}</p>
          <h1 className="mt-1 font-serif text-3xl font-bold md:text-4xl">{t("cds.hero.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-sidebar-foreground/80">
            {t("cds.hero.tagline")} {settings.college_name}.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        {/* Developer profile: full portrait + details */}
        <div className="grid gap-8 lg:grid-cols-5 lg:items-start">
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-lg border border-border bg-card tsu-shadow">
              <div className="aspect-[2/3] w-full bg-muted">
                <img
                  src={developerPortrait}
                  alt={t("cds.imageAlt")}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t("cds.profile.kicker")}</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-foreground md:text-3xl">Garba Sadiq Suleman</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">{t("cds.profile.role")}</p>

            <dl className="mt-6 space-y-3 text-sm">
              {([
                { icon: IdCard, labelKey: "cds.label.stateCode", value: "JG/26A/2107" },
                { icon: School, labelKey: "cds.label.ppa", value: "Model Day Primary School Kazaure" },
                { icon: MapPin, labelKey: "cds.label.location", value: "Sha'iskawa, Kazaure, Jigawa State" },
                { icon: CalendarDays, labelKey: "cds.label.serviceYear", value: "Batch A2 2026" },
              ] as { icon: typeof IdCard; labelKey: DictKey; value: string }[]).map(({ icon: Icon, labelKey, value }) => (
                <div key={labelKey} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t(labelKey)}</dt>
                    <dd className="text-foreground">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Project description */}
        <div className="mt-14">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t("cds.desc.kicker")}</p>
          <h2 className="mt-1 font-serif text-xl font-bold text-foreground md:text-2xl">{t("cds.info.projectValue")}</h2>
          <div className="mt-4 max-w-4xl space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>{t("cds.desc.p1")}</p>
            <p>{t("cds.desc.p2")}</p>
            <p>{t("cds.desc.p3")}</p>
          </div>
        </div>

        {/* Project information grid */}
        <div className="mt-14">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t("cds.info.kicker")}</p>
          <Card className="mt-4 border-border tsu-shadow">
            <CardContent className="grid gap-x-8 gap-y-5 p-6 sm:grid-cols-2">
              {PROJECT_INFO.map(({ labelKey, valueKey, value }) => (
                <div key={labelKey}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t(labelKey)}</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{valueKey ? t(valueKey) : value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Developer contribution */}
        <div className="mt-14 max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t("cds.dev.kicker")}</p>
          <Card className="mt-4 border-border tsu-shadow">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
              <Code2 className="h-7 w-7 shrink-0 text-primary" />
              <div>
                <h3 className="font-serif text-lg font-bold text-foreground">Garba Sadiq Suleman</h3>
                <p className="text-sm text-muted-foreground">{t("cds.dev.role")}</p>
                <p className="mt-3 text-sm italic leading-relaxed text-muted-foreground">
                  "{t("cds.dev.quote")}"
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}
