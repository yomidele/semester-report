import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProtectedExamOfficer } from "@/components/ProtectedExamOfficer";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { setStudentRepeatFlag } from "@/lib/school-admin.functions";

export const Route = createFileRoute("/exam-officer/promotions")({
  head: () => ({ meta: [{ title: "Promotions & Repeats — Exam Officer" }] }),
  component: () => <ProtectedExamOfficer><Page /></ProtectedExamOfficer>,
});

function Page() {
  const qc = useQueryClient();
  const setRepeat = useServerFn(setStudentRepeatFlag);
  const [departmentId, setDepartmentId] = useState("");
  const [armId, setArmId] = useState("");

  const departmentsQ = useQuery({
    queryKey: ["departments-with-next"],
    queryFn: async () => (await supabase.from("departments").select("id, name, next_department_id").order("name")).data ?? [],
  });
  const armsQ = useQuery({ queryKey: ["class-arms-all"], queryFn: async () => (await supabase.from("class_arms").select("id, name, department_id").order("name")).data ?? [] });

  const armsForClass = useMemo(() => (armsQ.data ?? []).filter((a) => a.department_id === departmentId), [armsQ.data, departmentId]);
  const selectedDept = departmentsQ.data?.find((d) => d.id === departmentId);

  const studentsQ = useQuery({
    queryKey: ["students-for-promotion", departmentId, armId],
    enabled: !!departmentId,
    queryFn: async () => {
      let query = supabase.from("students").select("id, full_name, matric_number, repeat_flag, class_arm_id").eq("department_id", departmentId).order("full_name");
      if (armId) query = query.eq("class_arm_id", armId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ student_id, repeat_flag }: { student_id: string; repeat_flag: boolean }) => setRepeat({ data: { student_id, repeat_flag } }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["students-for-promotion", departmentId, armId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Promotions &amp; Repeats</h2>
        <p className="text-sm text-muted-foreground">
          Promotion to the next class happens automatically the moment a new academic session is created (see the Sessions page).
          Flag any pupil who should repeat their current class here <b>before</b> that new session is created — everyone left
          unflagged will be promoted automatically.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <select className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setArmId(""); }}>
            <option value="">Select a class</option>
            {departmentsQ.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm" value={armId} onChange={(e) => setArmId(e.target.value)} disabled={!departmentId}>
            <option value="">All arms</option>
            {armsForClass.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </CardContent>
      </Card>

      {departmentId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedDept?.next_department_id
                ? <>Pupils promoted from here will move into: <span className="text-primary">{departmentsQ.data?.find((d) => d.id === selectedDept.next_department_id)?.name}</span></>
                : <span className="text-amber-600">No next class configured for {selectedDept?.name} — promoted pupils will be recorded as having completed their final class. Set this under Classes &amp; Arms if that's not intended.</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {studentsQ.data?.map((s) => (
              <label key={s.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <span>{s.full_name} <span className="text-xs text-muted-foreground">({s.matric_number})</span></span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Repeat this class</span>
                  <input
                    type="checkbox"
                    checked={s.repeat_flag}
                    onChange={(e) => toggleMut.mutate({ student_id: s.id, repeat_flag: e.target.checked })}
                    className="h-4 w-4"
                  />
                </span>
              </label>
            ))}
            {studentsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No pupils in this class/arm.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
