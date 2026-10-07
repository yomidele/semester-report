import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useCollegeSettings } from "@/lib/college-settings";
import { Code2, MapPin, IdCard, School, CalendarDays } from "lucide-react";
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

const PROJECT_INFO = [
  { label: "Project", value: "School Management System" },
  { label: "Project Type", value: "NYSC Personal CDS" },
  { label: "Developer", value: "Garba Sadiq Suleman" },
  { label: "NYSC State Code", value: "JG/26A/2107" },
  { label: "PPA", value: "Model Day Primary School Kazaure" },
  { label: "Location", value: "Sha'iskawa, Kazaure, Jigawa State" },
  { label: "Service Year", value: "2026A Batch" },
] as const;

function CdsProject() {
  const { settings } = useCollegeSettings();

  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Community Development Service</p>
          <h1 className="mt-1 font-serif text-3xl font-bold md:text-4xl">NYSC Personal CDS Project</h1>
          <p className="mt-2 max-w-2xl text-sm text-sidebar-foreground/80">
            School Management System — developed for {settings.college_name}.
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
                  alt="Garba Sadiq Suleman, NYSC Corps Member, in full NYSC uniform"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Developer Profile</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-foreground md:text-3xl">Garba Sadiq Suleman</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">NYSC Corps Member &amp; Project Developer</p>

            <dl className="mt-6 space-y-3 text-sm">
              {[
                { icon: IdCard, label: "NYSC State Code", value: "JG/26A/2107" },
                { icon: School, label: "PPA", value: "Model Day Primary School Kazaure" },
                { icon: MapPin, label: "Location", value: "Sha'iskawa, Kazaure, Jigawa State" },
                { icon: CalendarDays, label: "Service Year", value: "2026A Batch" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
                    <dd className="text-foreground">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Project description */}
        <div className="mt-14">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Project Description</p>
          <h2 className="mt-1 font-serif text-xl font-bold text-foreground md:text-2xl">School Management System</h2>
          <div className="mt-4 max-w-4xl space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              This School Management System was designed and developed for Model Day Primary School Kazaure as a
              Personal Community Development Service (CDS) project by Garba Sadiq Suleman, an NYSC Corps Member
              serving at the school during the 2026A Batch service year.
            </p>
            <p>
              The project was developed to support the school's academic and administrative activities through
              digital management of student records, staff information, classes, subjects, attendance,
              examinations, results, report cards, admissions, and other relevant school operations.
            </p>
            <p>
              The goal of the project is to contribute to the digital development of the school, improve record
              keeping, reduce reliance on manual processes, and provide authorized school personnel with a
              centralized platform for managing school information.
            </p>
          </div>
        </div>

        {/* Project information grid */}
        <div className="mt-14">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Project Information</p>
          <Card className="mt-4 border-border tsu-shadow">
            <CardContent className="grid gap-x-8 gap-y-5 p-6 sm:grid-cols-2">
              {PROJECT_INFO.map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Developer contribution */}
        <div className="mt-14 max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Project Developer</p>
          <Card className="mt-4 border-border tsu-shadow">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
              <Code2 className="h-7 w-7 shrink-0 text-primary" />
              <div>
                <h3 className="font-serif text-lg font-bold text-foreground">Garba Sadiq Suleman</h3>
                <p className="text-sm text-muted-foreground">NYSC Corps Member — 2026A Batch · State Code: JG/26A/2107</p>
                <p className="mt-3 text-sm italic leading-relaxed text-muted-foreground">
                  "Designed and developed by Garba Sadiq Suleman as an NYSC Personal CDS project in service to
                  education and community development."
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}
