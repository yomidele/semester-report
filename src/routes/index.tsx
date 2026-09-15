import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, BookOpen, Users, HeartHandshake, ArrowRight, CheckCircle2, User } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useCollegeSettings } from "@/lib/college-settings";
import { useProgrammes, useSchools, durationLabel } from "@/lib/public-catalog";
import { usePublishedStaff, categoryLabel } from "@/lib/staff";
import heroImg from "@/assets/campus-hero.jpg";

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
  { icon: BookOpen, title: "Creative Learning", body: "Engaging lessons that help pupils build strong foundations in every subject." },
  { icon: Users, title: "Caring Teachers", body: "Teachers work closely with pupils and families to support steady progress." },
  { icon: GraduationCap, title: "Strong Foundations", body: "A clear Primary 1–6 learning journey with age-appropriate assessment." },
  { icon: HeartHandshake, title: "Character Development", body: "A welcoming school culture that nurtures confidence, respect and responsibility." },
];

function Home() {
  const { settings } = useCollegeSettings();
  const { data: schools = [] } = useSchools();
  const { data: programmes = [] } = useProgrammes();
  const { data: staff = [] } = usePublishedStaff();
  const activeProgrammes = programmes.filter((p) => p.is_active).slice(0, 6);

  return (
    <PublicLayout>
      <section className="relative isolate overflow-hidden">
        <img src={heroImg} alt="Pupils learning together in a primary school classroom" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-primary/85" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Admissions open for the new session</p>
          <h1 className="mt-4 max-w-3xl font-serif text-3xl font-bold leading-tight text-primary-foreground md:text-5xl">
            {settings.college_name}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-primary-foreground/85 md:text-lg">
            A safe and encouraging place for children to learn, grow in character and build the skills they need for the future.
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
                Explore our learning sections, primary classes and the subjects that shape each pupil's school journey.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {schools.filter((s) => s.is_active).map((s) => (
              <Card key={s.id} className="tsu-shadow border-border">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">{s.code}</p>
                  <h3 className="mt-1 font-serif text-lg font-bold text-primary">{s.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{s.description ?? "Accredited school section."}</p>
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
          <h2 className="font-serif text-2xl font-bold text-foreground md:text-3xl">Learning Programmes</h2>
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

      {staff.length > 0 && (
        <section className="bg-secondary/60 py-14">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <h2 className="font-serif text-2xl font-bold text-foreground md:text-3xl">School Administration</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Meet the Head Teacher, Vice Head Teacher, and the teachers who guide our pupils every day.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {staff.map((member) => (
                <Card key={member.id} className="tsu-shadow border-border text-center">
                  <CardContent className="flex flex-col items-center p-6">
                    <Avatar className="h-24 w-24 border-2 border-primary/20">
                      <AvatarImage src={member.photo_url ?? undefined} alt={member.full_name} className="object-cover" />
                      <AvatarFallback className="bg-primary/10">
                        <User className="h-10 w-10 text-primary/60" />
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="mt-4 font-serif text-base font-bold text-foreground">{member.full_name}</h3>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-primary">{member.role_title || categoryLabel(member.category)}</p>
                    {member.bio && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{member.bio}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="tsu-header-grad py-14 text-sidebar-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 md:grid-cols-2 md:px-6">
          <div>
            <h2 className="font-serif text-2xl font-bold md:text-3xl">Admission Requirements</h2>
            <p className="mt-2 text-sm text-sidebar-foreground/80">
              Enrolment is open for children entering the appropriate primary class, subject to available places.
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            {[
              "Birth certificate or other identification document",
              "Recent passport photograph",
              "Completed application and admission screening",
              "Parent or guardian contact information",
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
