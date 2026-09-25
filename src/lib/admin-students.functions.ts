import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Admin "Student Management" roster tool (src/routes/students.tsx). Staff
// shouldn't have to invent or type an admission number by hand — it's not
// something anyone in a primary/secondary school thinks about day to day —
// so this allocates one the same way self-registration does (see
// registerStudentWithToken in student-registration.functions.ts), using the
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
      .select("id, department_id, departments(code)")
      .eq("id", data.class_arm_id)
      .maybeSingle();
    if (armErr) throw new Error(armErr.message);
    if (!arm) throw new Error("Class not found");

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
    } as never);
    if (insErr) throw new Error(insErr.message);

    return { ok: true as const, admission_number };
  });
