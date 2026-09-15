import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useCollegeSettings } from "@/lib/college-settings";
import { Target, Eye, ShieldCheck } from "lucide-react";

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
  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">About Our School</h1>
          <p className="mt-2 max-w-2xl text-sm text-sidebar-foreground/80">{settings.motto}</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="prose-sm max-w-3xl space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            {settings.college_name} is a welcoming primary school dedicated to helping children learn confidently,
            build good character and develop strong foundations for the next stage of their education.
          </p>
          <p>
            Our teachers combine clear classroom instruction, practical activities and individual support so every
            pupil can participate, make progress and feel proud of their work.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: Target, title: "Our Mission", body: "To provide every child with a strong academic foundation in a caring, disciplined and supportive environment." },
            { icon: Eye, title: "Our Vision", body: "To be a trusted primary school recognised for confident learners, good character and consistent achievement." },
            { icon: ShieldCheck, title: "Our Standards", body: "We work with families and teachers to maintain high standards of care, learning and pupil support." },
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
