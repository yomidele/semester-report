import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, BookOpen, Users, HeartHandshake, ArrowRight, CheckCircle2, User } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useCollegeSettings } from "@/lib/college-settings";
import { useProgrammes, useSchools, durationLabel } from "@/lib/public-catalog";
import { useManagementBoard, categoryLabel } from "@/lib/staff";
import { useT } from "@/lib/i18n";
import heroImg from "@/assets/pupils-hero.jpg";
import developerPortrait from "@/assets/nysc-developer-portrait.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Model Day Primary School Kazaure" },
      {
        name: "description",
        content: "Model Day Primary School Kazaure provides a caring, well-organised learning environment for primary pupils.",
      },
      { property: "og:title", content: "Model Day Primary School Kazaure" },
      {
        property: "og:description",
        content: "Primary classes, pupil support, school news and results for Model Day Primary School Kazaure.",
      },
    ],
  }),
  component: Home,
});

const FEATURES = [
  { icon: BookOpen, titleKey: "home.features.creativeLearning.title", bodyKey: "home.features.creativeLearning.body" },
  { icon: Users, titleKey: "home.features.caringTeachers.title", bodyKey: "home.features.caringTeachers.body" },
  { icon: GraduationCap, titleKey: "home.features.strongFoundations.title", bodyKey: "home.features.strongFoundations.body" },
  { icon: HeartHandshake, titleKey: "home.features.characterDevelopment.title", bodyKey: "home.features.characterDevelopment.body" },
] as const;

const ADMISSION_REQUIREMENTS = ["home.admissionReq.item1", "home.admissionReq.item2", "home.admissionReq.item3", "home.admissionReq.item4"] as const;

function Home() {
  const { settings } = useCollegeSettings();
  const { data: schools = [] } = useSchools();
  const { data: programmes = [] } = useProgrammes();
  const { data: staff = [] } = useManagementBoard();
  const t = useT();
  const activeProgrammes = programmes.filter((p) => p.is_active).slice(0, 6);

  return (
    <PublicLayout>
      <section className="relative isolate overflow-hidden">
        <img src={heroImg} alt="Smiling pupils in uniform arriving at school with their backpacks" className="absolute inset-0 h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/75 to-primary/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            {settings.admissions_open ? t("home.hero.admissionsOpen") : t("home.hero.admissionsClosed")}
          </p>
          <h1 className="mt-4 max-w-3xl font-serif text-3xl font-bold leading-tight text-primary-foreground md:text-5xl">
            {settings.college_name}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-primary-foreground/85 md:text-lg">
            {t("home.hero.tagline")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/apply">
                {t("home.hero.applyNow")} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-accent bg-transparent text-accent hover:bg-accent hover:text-accent-foreground">
              <Link to="/programmes">{t("home.hero.explorerProgrammes")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, titleKey, bodyKey }) => (
            <Card key={titleKey} className="tsu-shadow border-border">
              <CardContent className="p-5">
                <Icon className="h-7 w-7 text-primary" />
                <h3 className="mt-3 font-serif text-base font-bold text-foreground">{t(titleKey)}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{t(bodyKey)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="order-2 md:order-1">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-accent-foreground">{t("home.lifeAtSchool.kicker")}</p>
            <h2 className="mt-3 font-serif text-2xl font-bold text-foreground md:text-3xl">
              {t("home.lifeAtSchool.heading")}
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
              {t("home.lifeAtSchool.body")}
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/about">{t("home.lifeAtSchool.cta")}</Link>
            </Button>
          </div>
          <div className="order-1 md:order-2">
            <div className="relative overflow-hidden rounded-2xl border-4 border-accent/40 shadow-lg">
              <img
                src={heroImg}
                alt="Pupils in uniform walking together at school, smiling"
                className="h-72 w-full object-cover object-top sm:h-80 md:h-96"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-secondary/60 py-14">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h2 className="font-serif text-2xl font-bold text-foreground md:text-3xl">{t("home.schoolsSection.heading")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {t("home.schoolsSection.body")}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {schools.filter((s) => s.is_active).map((s) => (
              <Card key={s.id} className="tsu-shadow border-border">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">{s.code}</p>
                  <h3 className="mt-1 font-serif text-lg font-bold text-primary">{s.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{s.description ?? t("home.schoolDefaultDescription")}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/schools">{t("home.schoolsSection.viewAll")}</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6">
          <h2 className="font-serif text-2xl font-bold text-foreground md:text-3xl">{t("home.programmesSection.heading")}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeProgrammes.map((p) => (
            <Card key={p.id} className="tsu-shadow border-border">
              <CardContent className="p-5">
                <h3 className="font-serif text-base font-bold text-primary">{p.name}</h3>
                <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                  {p.award} · {durationLabel(p.duration_years)}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.description ?? t("home.programmeDefaultDescription")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button asChild className="mt-6">
          <Link to="/programmes">{t("home.programmesSection.seeAll")}</Link>
        </Button>
      </section>

      {staff.length > 0 && (
        <section className="bg-secondary/60 py-14">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <h2 className="font-serif text-2xl font-bold text-foreground md:text-3xl">{t("home.managementBoard.heading")}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {t("home.managementBoard.body")}
            </p>
            <div className="mt-6 -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden px-4 pb-2 [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [touch-action:pan-x] sm:gap-6 [&::-webkit-scrollbar]:hidden">
              {staff.map((member) => (
                <div key={member.id} className="flex w-32 shrink-0 snap-start flex-col items-center text-center sm:w-40">
                  <Avatar className="h-24 w-24 border-2 border-primary/20 sm:h-32 sm:w-32">
                    <AvatarImage src={member.photo_url ?? undefined} alt={member.full_name} className="object-cover" />
                    <AvatarFallback className="bg-primary/10">
                      <User className="h-10 w-10 text-primary/60" />
                    </AvatarFallback>
                  </Avatar>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{member.role_title || categoryLabel(member.category)}</p>
                  <h3 className="mt-1 font-serif text-base font-bold text-foreground">{member.full_name}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="tsu-header-grad py-14 text-sidebar-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 md:grid-cols-2 md:px-6">
          <div>
            <h2 className="font-serif text-2xl font-bold md:text-3xl">{t("home.admissionReq.heading")}</h2>
            <p className="mt-2 text-sm text-sidebar-foreground/80">
              {t("home.admissionReq.body")}
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            {ADMISSION_REQUIREMENTS.map((r) => (
              <li key={r} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {t(r)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <Link to="/cds-project" className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={t("home.cds.ariaLabel")}>
          <Card className="tsu-shadow border-border transition-all group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-md">
            <CardContent className="flex flex-col items-center gap-5 p-5 sm:flex-row">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:h-28 sm:w-28">
                <img src={developerPortrait} alt="" className="h-full w-full object-cover object-top" />
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">{t("home.cds.kicker")}</p>
                <h3 className="mt-1 font-serif text-lg font-bold text-foreground">
                  {t("home.cds.heading")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("home.cds.body")}
                </p>
                {/* Visible on every screen size (the old arrow icon was hidden on phones), so
                    visitors can tell the whole card is clickable. */}
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors group-hover:bg-primary/90">
                  {t("home.cds.cta")}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </section>
    </PublicLayout>
  );
}
