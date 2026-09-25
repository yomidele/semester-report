import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useCollegeSettings } from "@/lib/college-settings";
import { Target, Eye, ShieldCheck, BookOpen, Users, Home } from "lucide-react";
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
  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">About Our School</h1>
          <p className="mt-2 max-w-2xl text-sm text-sidebar-foreground/80">{settings.motto}</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        {/* Intro copy + first photo */}
        <div className="grid gap-8 lg:grid-cols-5 lg:items-center">
          <div className="lg:col-span-3 space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              {settings.college_name} sits in the heart of Kazaure, and for years families here have trusted us with
              something that matters a great deal to them: their children's first real steps into learning. We are
              a full primary school, taking pupils from Nursery through to Primary 6, and every one of our classes
              is run by teachers who know the difference between a child who is struggling quietly and one who is
              simply bored and needs to be stretched further.
            </p>
            <p>
              Our classrooms are not large by design — we keep class sizes manageable so that no pupil disappears
              into the back row. Mornings begin with assembly, where the whole school gathers under the trees on
              our compound before lessons start. It is a small ritual, but it sets the tone: this is a place where
              pupils are known by name, not just by number.
            </p>
            <p>
              Alongside Mathematics, English and the core primary curriculum, we place real weight on Qur'anic and
              Islamic studies, handwriting, and the kind of discipline that carries a child well beyond our gates —
              punctuality, respect for teachers and elders, and taking care of shared property. We work closely
              with parents and guardians, because a school report only tells half the story; the rest happens at
              home, and we take that partnership seriously.
            </p>
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
            { icon: Target, title: "Our Mission", body: "To give every child who passes through our gates a solid academic foundation, sound moral character, and the confidence to keep learning long after they leave Primary 6." },
            { icon: Eye, title: "Our Vision", body: "To be the primary school families in Kazaure recommend to one another — known for pupils who read well, count well, and carry themselves with good character." },
            { icon: ShieldCheck, title: "Our Standards", body: "Attendance is tracked, results are recorded honestly term by term, and every class has a form master parents can reach directly with questions about their child." },
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
            <p>
              Every term ends the same way for every pupil: a proper report card, filled in by their own class
              teacher, showing exactly how they performed in each subject and how their attendance looked over the
              term. Parents don't have to guess — they can see it in black and white, and they're welcome to come
              in and discuss it with the form master directly.
            </p>
            <p>
              We are still a growing school, and we don't pretend otherwise. What we can promise is that the people
              teaching your child live in this community, answer to a Head Teacher who is genuinely reachable, and
              take it personally when a pupil falls behind. That is the standard we hold ourselves to, term after
              term.
            </p>
          </div>
        </div>

        {/* Quick facts strip */}
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            { icon: BookOpen, label: "Nursery through Primary 6" },
            { icon: Users, label: "Small classes, known by name" },
            { icon: Home, label: "Based in Kazaure, Jigawa State" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
              <Icon className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
