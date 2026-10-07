import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useCollegeSettings } from "@/lib/college-settings";
import { Target, Eye, ShieldCheck, BookOpen, Users, Home } from "lucide-react";
import { useT } from "@/lib/i18n";
import teacherWithPupils from "@/assets/about-pupils-teacher.jpg";
import pupilsGroup from "@/assets/about-pupils-group.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Model Day Primary School Kazaure" },
      {
        name: "description",
        content: "Learn about our Nigerian primary school: mission, vision, governance and accreditation for primary education.",
      },
      { property: "og:title", content: "About Model Day Primary School Kazaure" },
      { property: "og:description", content: "Mission, vision, governance and accreditation of our primary school." },
    ],
  }),
  component: About,
});

function About() {
  const { settings } = useCollegeSettings();
  const t = useT();
  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">{t("about.hero.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-sidebar-foreground/80">{settings.motto}</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        {/* Intro copy + first photo */}
        <div className="grid gap-8 lg:grid-cols-5 lg:items-center">
          <div className="lg:col-span-3 space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              {settings.college_name} {t("about.intro.p1")}
            </p>
            <p>{t("about.intro.p2")}</p>
            <p>{t("about.intro.p3")}</p>
          </div>
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-lg tsu-shadow">
              <img
                src={teacherWithPupils}
                alt="A teacher addressing pupils gathered under a tree on the school compound"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Mission / Vision / Standards */}
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { icon: Target, titleKey: "about.mission.title", bodyKey: "about.mission.body" },
            { icon: Eye, titleKey: "about.vision.title", bodyKey: "about.vision.body" },
            { icon: ShieldCheck, titleKey: "about.standards.title", bodyKey: "about.standards.body" },
          ].map(({ icon: Icon, titleKey, bodyKey }) => (
            <Card key={titleKey} className="tsu-shadow border-border">
              <CardContent className="p-5">
                <Icon className="h-7 w-7 text-primary" />
                <h2 className="mt-3 font-serif text-lg font-bold text-foreground">{t(titleKey as any)}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{t(bodyKey as any)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Second photo + "life at school" copy */}
        <div className="mt-14 grid gap-8 lg:grid-cols-5 lg:items-center">
          <div className="order-2 lg:order-1 lg:col-span-2">
            <div className="overflow-hidden rounded-lg tsu-shadow">
              <img
                src={pupilsGroup}
                alt="A group of our pupils in school uniform standing together on the compound"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="order-1 lg:order-2 lg:col-span-3 space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>{t("about.lifeAtSchool.p1")}</p>
            <p>{t("about.lifeAtSchool.p2")}</p>
          </div>
        </div>

        {/* Quick facts strip */}
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            { icon: BookOpen, labelKey: "about.quickFacts.nurseryToPrimary6" },
            { icon: Users, labelKey: "about.quickFacts.smallClasses" },
            { icon: Home, labelKey: "about.quickFacts.basedInKazaure" },
          ].map(({ icon: Icon, labelKey }) => (
            <div key={labelKey} className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
              <Icon className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm font-medium text-foreground">{t(labelKey as any)}</span>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
