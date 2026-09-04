import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSchools, useDepartments, useProgrammes, durationLabel } from "@/lib/public-catalog";

export const Route = createFileRoute("/programmes")({
  head: () => ({
    meta: [
      { title: "Programmes — 2, 3 and 4 Year Health Courses" },
      {
        name: "description",
        content: "Certificate, diploma and higher diploma health programmes with durations from two to four years, open to secondary school leavers.",
      },
      { property: "og:title", content: "Programmes — 2, 3 and 4 Year Health Courses" },
      { property: "og:description", content: "Browse accredited health programmes, awards, durations and entry requirements." },
    ],
  }),
  component: Programmes,
});

function Programmes() {
  const { data: schools = [] } = useSchools();
  const { data: departments = [] } = useDepartments();
  const { data: programmes = [], isLoading } = useProgrammes();
  const [q, setQ] = useState("");
  const [duration, setDuration] = useState<number | null>(null);

  const durations = [...new Set(programmes.map((p) => p.duration_years))].sort((a, b) => a - b);
  const filtered = programmes.filter((p) => {
    if (!p.is_active) return false;
    if (duration && p.duration_years !== duration) return false;
    const hay = `${p.name} ${p.code} ${p.award}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">Programmes</h1>
          <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">
            Programme lengths vary by award — no programme is fixed to a single duration.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search programmes…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Button variant={duration === null ? "default" : "outline"} size="sm" onClick={() => setDuration(null)}>
            All durations
          </Button>
          {durations.map((d) => (
            <Button key={d} variant={duration === d ? "default" : "outline"} size="sm" onClick={() => setDuration(d)}>
              {durationLabel(d)}
            </Button>
          ))}
        </div>

        {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading programmes…</p>}
        {!isLoading && filtered.length === 0 && <p className="mt-6 text-sm text-muted-foreground">No programmes match your search.</p>}

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const dept = departments.find((d) => d.id === p.department_id);
            const school = schools.find((s) => s.id === p.faculty_id);
            return (
              <Card key={p.id} className="tsu-shadow flex flex-col border-border">
                <CardContent className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-serif text-base font-bold text-primary">{p.name}</h2>
                    <Badge variant="secondary">{durationLabel(p.duration_years)}</Badge>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                    {p.award} · {p.code}
                  </p>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.description ?? "Programme details available on request."}</p>
                  <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div>School: <span className="text-foreground">{school?.name ?? "—"}</span></div>
                    <div>Department: <span className="text-foreground">{dept?.name ?? "—"}</span></div>
                    <div>Units per semester: <span className="text-foreground">{p.min_units}–{p.max_units}</span></div>
                  </dl>
                  {p.requirements && <p className="mt-3 text-xs text-muted-foreground"><strong className="text-foreground">Entry:</strong> {p.requirements}</p>}
                  <Button asChild size="sm" className="mt-4 w-full">
                    <Link to="/admissions">Apply for this programme</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </PublicLayout>
  );
}
