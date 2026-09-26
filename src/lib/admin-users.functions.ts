import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getCallerRoles(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

// ===== Lecturers =====
export const createLecturer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(128),
      full_name: z.string().min(1).max(255),
      phone: z.string().max(40).optional().nullable(),
      department_id: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      const roles = await getCallerRoles(context.userId);
      if (!roles.includes("super_admin")) throw new Error("Forbidden: only Super Admin can create teacher accounts");
      const { data: dept } = await supabaseAdmin.from("departments").select("id, faculty_id").eq("id", data.department_id).maybeSingle();
      if (!dept) throw new Error("Department not found");

      const { data: created, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email, password: data.password, email_confirm: true,
        user_metadata: { full_name: data.full_name },
      });
      if (signUpError || !created?.user) throw new Error(signUpError?.message ?? "Failed to create user");
      const userId = created.user.id;

      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "teacher" });
      if (roleError) {
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        throw new Error(`Role assignment failed: ${roleError.message}`);
      }

      const { error: insErr } = await supabaseAdmin.from("lecturers").insert({
        user_id: userId, faculty_id: dept.faculty_id, department_id: dept.id,
        full_name: data.full_name, email: data.email, phone: data.phone ?? null,
      });
      if (insErr) {
        try { await supabaseAdmin.from("user_roles").delete().eq("user_id", userId); } catch {}
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        throw new Error(`Lecturer insert failed: ${insErr.message}`);
      }
      return { user_id: userId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("createLecturer failed:", msg);
      throw new Error(msg);
    }
  });

export const deleteLecturer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const roles = await getCallerRoles(context.userId);
    if (!roles.includes("super_admin")) throw new Error("Forbidden");
    await supabaseAdmin.from("lecturers").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "teacher");
    await supabaseAdmin.auth.admin.deleteUser(data.user_id).catch(() => {});
    return { ok: true };
  });

export const createTeacher = createLecturer;
export const deleteTeacher = deleteLecturer;
