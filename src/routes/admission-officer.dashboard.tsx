import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedAdmissionOfficer } from "@/components/ProtectedAdmissionOfficer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdmissionRecords, type AdmissionRecord } from "@/lib/admission-records.functions";
import { Users, UserPlus, Search, UserRound } from "lucide-react";
import { AdmissionsToggle } from "@/components/AdmissionsToggle";

export const Route = createFileRoute("/admission-officer/dashboard")({
  head: () => ({ meta: [{ title: "Admission Officer Dashboard — School Portal" }] }),
  component: () => <ProtectedAdmissionOfficer><Page /></ProtectedAdmissionOfficer>,
});

const PAGE_SIZE = 25;

function Page() {
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);

  const fetchRecords = useServerFn(listAdmissionRecords);
  const pupils = useQuery({
    queryKey: ["admission-records"],
    queryFn: () => fetchRecords(),
  });

  const all: AdmissionRecord[] = pupils.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((p) => p.full_name.toLowerCase().includes(q) || p.matric_number.toLowerCase().includes(q));
  }, [all, search]);

  const classLabel = (p: AdmissionRecord) => p.class_label ?? "Not yet assigned";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Admission Officer</h2>
        <p className="text-sm text-muted-foreground">Enrol new pupils, issue their admission letters, and look up any pupil's record.</p>
      </div>
      <AdmissionsToggle />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="tsu-shadow">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <Users className="h-5 w-5 text-primary" />
              <p className="mt-2 text-2xl font-bold">{pupils.isLoading ? "—" : all.length}</p>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Enrolled pupils</p>
            </div>
          </CardContent>
        </Card>
        <Card className="tsu-shadow">
          <CardContent className="flex flex-col items-start gap-3 p-4">
            <UserPlus className="h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">Ready to admit a new pupil? Enter their details and an admission letter is generated instantly.</p>
            <Link to="/admission-officer/enroll"><Button size="sm">Enrol a pupil</Button></Link>
          </CardContent>
        </Card>
      </div>

      <Card className="tsu-shadow">
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Pupil records</CardTitle>
          <div className="relative sm:w-80">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShown(PAGE_SIZE); }}
              placeholder="Search by name or admission number..."
              className="h-9 pl-8"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {pupils.isError && (
            <p className="px-4 pb-4 text-sm text-destructive">Couldn't load pupil records: {(pupils.error as Error).message}</p>
          )}
          {!pupils.isError && !pupils.isLoading && filtered.length === 0 && (
            <p className="px-4 pb-4 text-sm text-muted-foreground">{all.length === 0 ? "No pupils enrolled yet." : "No pupils match your search."}</p>
          )}
          <ul className="divide-y">
            {filtered.slice(0, shown).map((p) => (
              <li key={p.id}>
                <Link
                  to="/admission-officer/records"
                  search={{ student: p.id }}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40"
                >
                  <Avatar className="h-11 w-11 rounded-md border border-border">
                    <AvatarImage src={p.passport_url ?? undefined} alt={p.full_name} className="object-cover" />
                    <AvatarFallback className="rounded-md bg-secondary"><UserRound className="h-5 w-5 text-muted-foreground" /></AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.matric_number} · {classLabel(p)}</p>
                  </div>
                  {p.status !== "active" && <Badge variant="outline" className="capitalize">{p.status}</Badge>}
                </Link>
              </li>
            ))}
          </ul>
          {filtered.length > shown && (
            <div className="border-t p-3 text-center">
              <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                Show more ({filtered.length - shown} remaining)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
