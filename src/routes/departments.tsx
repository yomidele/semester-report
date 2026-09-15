import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSchools, useClasss, useProgrammes, durationLabel } from "@/lib/public-catalog";

export const Route = createFileRoute("/departments")({
  head: () => ({
    meta: [
      { title: "Classes — Model Day Primary School Kazaure" },
      { name: "description", content: "Explore the departments of the college and the health programmes each one runs, from community health to medical laboratory technology." },
      { property: "og:title", content: "Classes — Model Day Primary School Kazaure" },
      { property: "og:description", content: "Explore primary classes and learning programmes at Model Day Primary School Kazaure." },
    ],
  }),
  component: Classes,
});

function Classes() {
  const { data: schools = [] } = useSchools();
  const { data: departments = [], isLoading } = useClasss();
  const { data: programmes = [] } = useProgrammes();

  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">Classes</h1>
          <p className="mt-2 max-w-2xl text-sm text-sidebar-foreground/80">
            Classes provide a supportive learning environment for every child.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        {isLoading && <p className="text-sm text-muted-foreground">Loading departments…</p>}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departments.filter((d) => d.is_active).map((d) => {
            const school = schools.find((s) => s.id === d.faculty_id);
            const progs = programmes.filter((p) => p.department_id === d.id && p.is_active);
            return (
              <Card key={d.id} className="tsu-shadow border-border">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{school?.name ?? "College"}</p>
                  <h2 className="mt-1 font-serif text-lg font-bold text-primary">{d.name}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{d.description ?? "Class of the college."}</p>
                  {progs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {progs.map((p) => (
                        <Badge key={p.id} variant="secondary">
                          {p.code} · {durationLabel(p.duration_years)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </PublicLayout>
  );
}
