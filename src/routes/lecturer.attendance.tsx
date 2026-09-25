import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedTeacher } from "@/components/ProtectedTeacher";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, WifiOff, Wifi, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  saveRosterCache,
  loadRosterCache,
  queueAttendanceMark,
  listQueuedMarksForClass,
  removeQueuedMark,
  type RosterCache,
} from "@/lib/offline-attendance-db";

export const Route = createFileRoute("/lecturer/attendance")({
  head: () => ({ meta: [{ title: "Attendance — Teacher" }] }),
  component: () => (
    <ProtectedTeacher>
      <Page />
    </ProtectedTeacher>
  ),
});

const STATUSES = [
  { value: "present", label: "Present", className: "bg-primary text-primary-foreground" },
  { value: "absent", label: "Absent", className: "bg-destructive text-destructive-foreground" },
  { value: "late", label: "Late", className: "bg-amber-500 text-white" },
  { value: "excused", label: "Excused", className: "bg-secondary text-secondary-foreground" },
] as const;

type StatusValue = (typeof STATUSES)[number]["value"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function Page() {
  const { session } = useAuthSession();
  const qc = useQueryClient();
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [date, setDate] = useState(todayISO());
  const [selectedArmId, setSelectedArmId] = useState<string>("");
  const [marks, setMarks] = useState<Record<string, { status: StatusValue; notes: string | null }>>({});
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [roster, setRoster] = useState<RosterCache | null>(null);
  const [rosterFromCache, setRosterFromCache] = useState(false);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const teacher = useQuery({
    queryKey: ["teacher-self", session?.user.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("lecturers").select("id, full_name").eq("user_id", session!.user.id).maybeSingle()).data,
  });

  // Class arm(s) this teacher form-masters. Only fetched while online —
  // choosing WHICH class to view requires a network round trip once, but
  // after that the roster itself is fully cached per class_arm_id.
  const formClassesQ = useQuery({
    queryKey: ["form-master-classes", teacher.data?.id],
    enabled: !!teacher.data && isOnline,
    queryFn: async () => {
      const { data } = await supabase
        .from("class_arms")
        .select("id, name, code, departments:department_id(name)")
        .eq("form_teacher_id", teacher.data!.id)
        .order("name");
      return data ?? [];
    },
  });

  const settingsQ = useQuery({
    queryKey: ["academic-settings-current"],
    enabled: isOnline,
    queryFn: async () => (await supabase.from("academic_settings").select("current_session_id, current_term").maybeSingle()).data,
  });

  useEffect(() => {
    if (!selectedArmId && formClassesQ.data && formClassesQ.data.length > 0) {
      setSelectedArmId(formClassesQ.data[0].id);
    }
  }, [formClassesQ.data, selectedArmId]);

  // Load roster: try network first (and refresh the cache), fall back to
  // whatever was cached from the last successful load.
  const loadRoster = useCallback(async (class_arm_id: string, attendance_date: string) => {
    if (!class_arm_id) return;
    if (isOnline) {
      try {
        const [{ data: students, error: sErr }, { data: existing, error: aErr }] = await Promise.all([
          supabase.from("students").select("id, full_name").eq("class_arm_id", class_arm_id).order("full_name"),
          supabase.from("attendance").select("student_id, status, notes").eq("class_arm_id", class_arm_id).eq("attendance_date", attendance_date),
        ]);
        if (sErr) throw sErr;
        if (aErr) throw aErr;
        const marksMap: Record<string, { status: string; notes: string | null }> = {};
        (existing ?? []).forEach((r: any) => { marksMap[r.student_id] = { status: r.status, notes: r.notes }; });
        const cache: RosterCache = {
          class_arm_id,
          cached_at: new Date().toISOString(),
          students: students ?? [],
          marks: marksMap,
        };
        await saveRosterCache(cache);
        setRoster(cache);
        setMarks(marksMap as any);
        setRosterFromCache(false);
        return;
      } catch {
        // fall through to cache below — e.g. a request that started online
        // and lost connectivity mid-flight
      }
    }
    const cached = await loadRosterCache(class_arm_id);
    if (cached) {
      setRoster(cached);
      setMarks(cached.marks as any);
      setRosterFromCache(true);
    } else {
      setRoster(null);
      toast.error("No cached roster for this class yet — open this page once while online first.");
    }
  }, [isOnline]);

  useEffect(() => {
    if (selectedArmId) loadRoster(selectedArmId, date);
  }, [selectedArmId, date, loadRoster]);

  // Merge in anything already queued (e.g. marked earlier offline, not yet synced)
  useEffect(() => {
    if (!selectedArmId) return;
    listQueuedMarksForClass(selectedArmId).then((entries) => {
      const forToday = entries.filter((e) => e.attendance_date === date);
      if (forToday.length === 0) return;
      setMarks((prev) => {
        const next = { ...prev };
        forToday.forEach((e) => { next[e.student_id] = { status: e.status as StatusValue, notes: e.notes }; });
        return next;
      });
      setPendingKeys(new Set(forToday.map((e) => e.key)));
    });
  }, [selectedArmId, date]);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const queued = await listQueuedMarksForClass(selectedArmId);
      let synced = 0;
      for (const entry of queued) {
        const { error } = await supabase.from("attendance").upsert(
          {
            student_id: entry.student_id,
            class_arm_id: entry.class_arm_id,
            session_id: entry.session_id,
            term: entry.term,
            attendance_date: entry.attendance_date,
            status: entry.status,
            notes: entry.notes,
            marked_by: entry.marked_by,
          } as never,
          { onConflict: "student_id,session_id,term,attendance_date" }
        );
        if (!error) {
          await removeQueuedMark(entry.key);
          setPendingKeys((prev) => { const n = new Set(prev); n.delete(entry.key); return n; });
          synced++;
        }
      }
      if (synced > 0) {
        toast.success(`Synced ${synced} attendance record${synced !== 1 ? "s" : ""}`);
        qc.invalidateQueries({ queryKey: ["attendance"] });
      }
    } finally {
      setSyncing(false);
    }
  }, [selectedArmId, qc]);

  useEffect(() => {
    if (isOnline) syncQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const mark = useCallback(
    async (studentId: string, status: StatusValue) => {
      setMarks((prev) => ({ ...prev, [studentId]: { status, notes: prev[studentId]?.notes ?? null } }));
      const sessionId = settingsQ.data?.current_session_id ?? roster?.students ? undefined : undefined;
      const session_id = settingsQ.data?.current_session_id;
      const term = settingsQ.data?.current_term ?? "First";
      const key = `${selectedArmId}:${studentId}:${date}`;

      // Try the network write directly when online; on any failure (or when
      // already offline) queue it instead so nothing is lost.
      if (isOnline && session_id) {
        const { error } = await supabase.from("attendance").upsert(
          {
            student_id: studentId,
            class_arm_id: selectedArmId,
            session_id,
            term,
            attendance_date: date,
            status,
            marked_by: teacher.data?.id ?? null,
          } as never,
          { onConflict: "student_id,session_id,term,attendance_date" }
        );
        if (!error) return;
      }

      await queueAttendanceMark({
        key,
        class_arm_id: selectedArmId,
        student_id: studentId,
        session_id: session_id ?? "",
        term,
        attendance_date: date,
        status,
        notes: null,
        marked_by: teacher.data?.id ?? null,
        queued_at: new Date().toISOString(),
      });
      setPendingKeys((prev) => new Set(prev).add(key));
    },
    [isOnline, selectedArmId, date, settingsQ.data, teacher.data, roster]
  );

  const students = roster?.students ?? [];
  const pendingCount = pendingKeys.size;

  if (formClassesQ.isLoading && isOnline) {
    return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold">Attendance</h2>
          <p className="text-sm text-muted-foreground">Mark daily attendance for your class — works offline and syncs automatically.</p>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300"><Wifi className="h-3.5 w-3.5" /> Online</Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300"><WifiOff className="h-3.5 w-3.5" /> Offline</Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="secondary" className="gap-1">{pendingCount} pending sync</Badge>
          )}
          <Button size="sm" variant="outline" onClick={syncQueue} disabled={!isOnline || syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sync now
          </Button>
        </div>
      </div>

      {!isOnline && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You're offline. Attendance you mark now is saved on this device and will sync automatically once you're back online.
          {rosterFromCache && " Showing the roster from your last online visit."}
        </div>
      )}

      {(formClassesQ.data ?? []).length > 1 && (
        <Tabs value={selectedArmId} onValueChange={setSelectedArmId}>
          <TabsList>
            {(formClassesQ.data ?? []).map((c: any) => (
              <TabsTrigger key={c.id} value={c.id}>{c.departments?.name ? `${c.departments.name} ` : ""}{c.name}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {!selectedArmId && !isOnline && !roster && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No class cached yet. Open this page once while online to load your class roster for offline use.</CardContent></Card>
      )}

      {!selectedArmId && isOnline && (formClassesQ.data ?? []).length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">You're not set as the form master of any class yet. Contact your Exam Officer.</CardContent></Card>
      )}

      {selectedArmId && (
        <Card className="tsu-shadow">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Class register</CardTitle>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="h-8 w-40" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pl-4 pr-3">Pupil</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const current = marks[s.id]?.status;
                    const key = `${selectedArmId}:${s.id}:${date}`;
                    const isPending = pendingKeys.has(key);
                    return (
                      <tr key={s.id} className="border-b">
                        <td className="py-2 pl-4 pr-3">{s.full_name}</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {STATUSES.map((st) => (
                              <button
                                key={st.value}
                                type="button"
                                onClick={() => mark(s.id, st.value)}
                                className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                                  current === st.value ? st.className : "bg-background text-muted-foreground border-border hover:bg-secondary"
                                }`}
                              >
                                {st.label}
                              </button>
                            ))}
                            {isPending && <span className="ml-1 text-[10px] text-amber-600">pending sync</span>}
                            {current && !isPending && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {students.length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">No pupils in this class yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
