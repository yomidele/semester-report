import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useCollegeSettings } from "@/lib/college-settings";
import { Target, Eye, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About the College — History, Mission & Accreditation" },
      {
        name: "description",
        content: "Learn about our Nigerian college of health technology: mission, vision, governance and accreditation for health training programmes.",
      },
      { property: "og:title", content: "About the College — History, Mission & Accreditation" },
      { property: "og:description", content: "Mission, vision, governance and accreditation of our college of health technology." },
    ],
  }),
  component: About,
});

function About() {
  const { settings } = useCollegeSettings();
  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">About the College</h1>
          <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">{settings.motto}</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="prose-sm max-w-3xl space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            {settings.college_name} is a health training institution dedicated to producing competent, ethical and
            community-minded health workers for Nigeria's health system. Our programmes admit secondary school leavers
            and run for two, three or four years depending on the award.
          </p>
          <p>
            Teaching combines classroom instruction, laboratory practicals and supervised clinical postings in
            hospitals, primary health care centres and diagnostic laboratories, so graduates enter service already
            familiar with real practice.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: Target, title: "Our Mission", body: "To train skilled, compassionate health practitioners through practice-based education and community service." },
            { icon: Eye, title: "Our Vision", body: "To be a leading college of health technology recognised for quality training and measurable community health impact." },
            { icon: ShieldCheck, title: "Accreditation", body: "Programmes are run in line with the standards of the relevant national health regulatory boards." },
          ].map(({ icon: Icon, title, body }) => (
            <Card key={title} className="tsu-shadow border-border">
              <CardContent className="p-5">
                <Icon className="h-7 w-7 text-primary" />
                <h2 className="mt-3 font-serif text-lg font-bold text-foreground">{title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
