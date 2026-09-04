import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useSchools, useDepartments } from "@/lib/public-catalog";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/schools")({
  head: () => ({
    meta: [
      { title: "Schools — Academic Divisions of the College" },
      { name: "description", content: "Browse the schools of the college: health technology, medical laboratory sciences, nursing sciences and their departments." },
      { property: "og:title", content: "Schools — Academic Divisions of the College" },
      { property: "og:description", content: "Schools and departments that host our accredited health training programmes." },
    ],
  }),
  component: Schools,
});

function Schools() {
  const { data: schools = [], isLoading } = useSchools();
  const { data: departments = [] } = useDepartments();

  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">Our Schools</h1>
          <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">
            Each school groups related departments and programmes under one academic leadership.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        {isLoading && <p className="text-sm text-muted-foreground">Loading schools…</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {schools.filter((s) => s.is_active).map((s) => {
            const depts = departments.filter((d) => d.faculty_id === s.id && d.is_active);
            return (
              <Card key={s.id} className="tsu-shadow border-border">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-1 h-6 w-6 shrink-0 text-primary" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.code}</p>
                      <h2 className="font-serif text-xl font-bold text-primary">{s.name}</h2>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{s.description ?? "Accredited school of the college."}</p>
                  {depts.length > 0 && (
                    <>
                      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-accent-foreground">Departments</h3>
                      <ul className="mt-2 space-y-1 text-sm text-foreground">
                        {depts.map((d) => (
                          <li key={d.id}>• {d.name}</li>
                        ))}
                      </ul>
                    </>
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
