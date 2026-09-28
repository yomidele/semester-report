import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Admin "Student Management" roster tool (src/routes/students.tsx). Staff
// shouldn't have to invent or type an admission number by hand — it's not
// something anyone in a primary/secondary school thinks about day to day —
// so this allocates one the same way self-registration does (see
// school's configured admission-number format, using the
// school's configured matric_format, and only ever surfaces it later, on
// the printed admission letter.

const Input = z.object({
  full_name: z.string().min(2).max(120),
  class_arm_id: z.string().uuid(),
});

export const adminEnrollStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "super_admin")) throw new Error("Forbidden");

    const { data: arm, error: armErr } = await supabaseAdmin
      .from("class_arms")
      .select("id, department_id, departments(code, faculty_id)")
      .eq("id", data.class_arm_id)
      .maybeSingle();
    if (armErr) throw new Error(armErr.message);
    if (!arm) throw new Error("Class not found");
    const faculty_id = (arm.departments as { code: string | null; faculty_id: string } | null)?.faculty_id;
    if (!faculty_id) throw new Error("This class's department has no faculty/section set — fix that first.");

    const yearCode = String(new Date().getFullYear()).slice(-2);
    const deptCode = ((arm.departments as { code: string | null } | null)?.code ?? "CLS").toUpperCase();
    const { data: seq, error: seqErr } = await supabaseAdmin.rpc("next_matric_seq", {
      _department_id: arm.department_id,
      _year_code: yearCode,
    });
    if (seqErr || typeof seq !== "number") throw new Error(seqErr?.message ?? "Could not allocate an admission number");

    const { data: settings } = await supabaseAdmin.from("college_settings").select("matric_format, matric_seq_padding").limit(1).maybeSingle();
    const matricFormat = settings?.matric_format ?? "{DEPT}/{YY}/{SEQ}";
    const sequence = String(seq).padStart(settings?.matric_seq_padding ?? 4, "0");
    const admission_number = matricFormat
      .replaceAll("{FAC}", deptCode)
      .replaceAll("{DEPT}", deptCode)
      .replaceAll("{CLASS}", deptCode)
      .replaceAll("{YY}", yearCode)
      .replaceAll("{SEQ}", sequence);

    const { error: insErr } = await supabaseAdmin.from("students").insert({
      matric_number: admission_number,
      full_name: data.full_name,
      class_arm_id: data.class_arm_id,
      department_id: arm.department_id,
      faculty_id,
      admission_date: new Date().toISOString(),
    } as never);
    if (insErr) throw new Error(insErr.message);

    return { ok: true as const, admission_number };
  });

// Takes a pupil off the active roster — withdrawn, transferred elsewhere, or
// graduated — WITHOUT deleting their row. Their results, attendance and
// report cards stay exactly where they are and stay findable (e.g. from
// Report Cards / transcripts) for as long as the school needs them. The
// database itself also refuses to hard-delete a student with any academic
// history (see migration 20260927120000), so this status change is the only
// supported way to remove someone from a class roster once they have any
// history at all.
const StatusInput = z.object({
  student_id: z.string().uuid(),
  status: z.enum(["active", "withdrawn", "transferred", "graduated"]),
  reason: z.string().max(500).optional(),
});

export const adminSetStudentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => StatusInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "super_admin")) throw new Error("Forbidden");

    const { data: student, error: findErr } = await supabaseAdmin
      .from("students")
      .select("id, full_name, status")
      .eq("id", data.student_id)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!student) throw new Error("Pupil not found");

    const { error: updErr } = await supabaseAdmin
      .from("students")
      .update({
        status: data.status,
        status_reason: data.reason?.trim() || null,
        status_date: new Date().toISOString().slice(0, 10),
        status_changed_at: new Date().toISOString(),
      } as never)
      .eq("id", data.student_id);
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "student_status_changed",
      entity_type: "students",
      entity_id: data.student_id,
      details: { from: student.status, to: data.status, reason: data.reason ?? null, full_name: student.full_name },
    } as never);

    return { ok: true as const };
  });
