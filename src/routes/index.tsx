import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Stethoscope, Microscope, HeartPulse, ArrowRight, CheckCircle2 } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCollegeSettings } from "@/lib/college-settings";
import { useProgrammes, useSchools, durationLabel } from "@/lib/public-catalog";
import heroImg from "@/assets/campus-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "College of Health Technology — Train for Healthcare in Nigeria" },
      {
        name: "description",
        content:
          "Accredited Nigerian College of Health Technology offering 2-, 3- and 4-year health programmes in nursing, medical laboratory science, community health and more.",
      },
      { property: "og:title", content: "College of Health Technology — Train for Healthcare in Nigeria" },
      {
        property: "og:description",
        content: "Health programmes for secondary school leavers: nursing, medical lab science, community health and public health.",
      },
    ],
  }),
  component: Home,
});

const FEATURES = [
  { icon: Stethoscope, title: "Clinical Training", body: "Supervised postings in teaching hospitals, PHC centres and diagnostic laboratories." },
  { icon: Microscope, title: "Modern Laboratories", body: "Practical-first learning in well-equipped anatomy, physiology and diagnostic labs." },
  { icon: GraduationCap, title: "Flexible Durations", body: "Certificate, diploma and higher diploma programmes running from 2 to 4 years." },
  { icon: HeartPulse, title: "Service to Community", body: "Outreach, immunisation drives and rural health campaigns as part of the curriculum." },
];

function Home() {
  const { settings } = useCollegeSettings();
  const { data: schools = [] } = useSchools();
  const { data: programmes = [] } = useProgrammes();
  const activeProgrammes = programmes.filter((p) => p.is_active).slice(0, 6);

  return (
    <PublicLayout>
      <section className="relative isolate overflow-hidden">
        <img src={heroImg} alt="Muslim and Christian health technology students in clinical training" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-primary/85" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Admissions open for the new session</p>
          <h1 className="mt-4 max-w-3xl font-serif text-3xl font-bold leading-tight text-primary-foreground md:text-5xl">
            {settings.college_name}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-primary-foreground/85 md:text-lg">
            Training Muslim and Christian students to become the next generation of Nigerian health professionals — nurses, laboratory scientists, community
            health practitioners and public health officers — from secondary school to certified practice.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/admissions">
                Apply Now <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-accent bg-transparent text-accent hover:bg-accent hover:text-accent-foreground">
              <Link to="/programmes">Explore Programmes</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="tsu-shadow border-border">
              <CardContent className="p-5">
                <Icon className="h-7 w-7 text-primary" />
                <h3 className="mt-3 font-serif text-base font-bold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-secondary/60 py-14">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h2 className="font-serif text-2xl font-bold text-foreground md:text-3xl">Our Schools</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Academic activities are organised into schools, each hosting departments and accredited programmes.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {schools.filter((s) => s.is_active).map((s) => (
              <Card key={s.id} className="tsu-shadow border-border">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">{s.code}</p>
                  <h3 className="mt-1 font-serif text-lg font-bold text-primary">{s.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{s.description ?? "Accredited health training school."}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/schools">View all schools</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <h2 className="font-serif text-2xl font-bold text-foreground md:text-3xl">Featured Programmes</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeProgrammes.map((p) => (
            <Card key={p.id} className="tsu-shadow border-border">
              <CardContent className="p-5">
                <h3 className="font-serif text-base font-bold text-primary">{p.name}</h3>
                <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                  {p.award} · {durationLabel(p.duration_years)}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.description ?? "Programme details available on request."}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button asChild className="mt-6">
          <Link to="/programmes">See all programmes</Link>
        </Button>
      </section>

      <section className="tsu-header-grad py-14 text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 md:grid-cols-2 md:px-6">
          <div>
            <h2 className="font-serif text-2xl font-bold md:text-3xl">Admission Requirements</h2>
            <p className="mt-2 text-sm text-primary-foreground/80">
              Entry is open to secondary school leavers with credits in relevant science subjects.
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            {[
              "Five O'Level credits including English Language and Mathematics",
              "Credits in Biology, Chemistry and Physics for science-based programmes",
              "Completed online application and screening",
              "Medical fitness certificate before clinical postings",
            ].map((r) => (
              <li key={r} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {r}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PublicLayout>
  );
}
