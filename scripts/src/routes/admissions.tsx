import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronDown, ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCollegeSettings } from "@/lib/college-settings";
import { durationLabel, useProgrammes } from "@/lib/public-catalog";

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

const REQUIREMENTS = [
  "Five O'Level credits including English Language and Mathematics",
  "Credits in Biology, Chemistry and Physics for science-based programmes",
  "Completed application and screening process",
  "Medical fitness certificate before clinical postings",
];

const FAQS = [
  {
    question: "How long do the programmes take?",
    answer: "Programme duration depends on the award and course. Check the programme list below for the current duration of each active programme.",
  },
  {
    question: "Can I apply before the next session opens?",
    answer: "You can contact the college for application dates and guidance on the next available admission cycle.",
  },
  {
    question: "What should I bring for screening?",
    answer: "Bring your academic credentials and any other documents requested in the current admission notice. Contact the college if you need a complete checklist.",
  },
];

function Admissions() {
  const { settings } = useCollegeSettings();
  const { data: programmes = [], isLoading } = useProgrammes();
  const activeProgrammes = programmes.filter((programme) => programme.is_active);
  const durations = [...new Set(activeProgrammes.map((programme) => programme.duration_years))].sort((a, b) => a - b);

  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">Admissions</h1>
          <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">
            Begin your journey at {settings.college_name} and prepare for meaningful work in healthcare.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 md:px-6">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent-foreground">Entry requirements</p>
            <h2 className="mt-2 font-serif text-2xl font-bold text-foreground md:text-3xl">What you need to apply</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Requirements may vary by programme. Review the course details and contact the college before submitting your application.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {REQUIREMENTS.map((requirement) => (
                <li key={requirement} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {requirement}
                </li>
              ))}
            </ul>
          </div>
          <Card className="border-border tsu-shadow">
            <CardContent className="p-6">
              <h2 className="font-serif text-xl font-bold text-primary">Ready to apply?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Application instructions and screening dates are available from the admissions office.
              </p>
              <Button asChild className="mt-5 w-full">
                <Link to="/apply">Start application <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link to="/programmes">Browse programmes</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-accent-foreground">Programme durations</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-foreground md:text-3xl">Choose your path</h2>
            </div>
            {durations.length > 0 && <p className="text-sm text-muted-foreground">{durations.map(durationLabel).join(" / ")}</p>}
          </div>
          {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading programmes...</p>}
          {!isLoading && activeProgrammes.length === 0 && <p className="mt-6 text-sm text-muted-foreground">Programme information is currently unavailable.</p>}
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeProgrammes.map((programme) => (
              <Card key={programme.id} className="border-border tsu-shadow">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{programme.award} · {programme.code}</p>
                  <h3 className="mt-2 font-serif text-lg font-bold text-primary">{programme.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{durationLabel(programme.duration_years)}</p>
                  {programme.requirements && <p className="mt-3 text-sm text-muted-foreground">{programme.requirements}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl font-bold text-foreground md:text-3xl">Frequently asked questions</h2>
          <div className="mt-5 divide-y divide-border border-y border-border">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-foreground">
                  {faq.question}
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
