import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TransitionInput = z.object({
  result_ids: z.array(z.string().uuid()).min(1).max(2000),
  reason: z.string().max(500).optional(),
});

async function getCallerRoles(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

export const lecturerSubmitResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TransitionInput.parse(i))
  .handler(async ({ data, context }) => {
    const roles = await getCallerRoles(context.userId);
    if (!roles.includes("teacher")) throw new Error("Forbidden");
    const { error } = await supabaseAdmin
      .from("results")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .in("id", data.result_ids)
      .eq("status", "draft");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const teacherSubmitResults = lecturerSubmitResults;

export const examOfficerApproveResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TransitionInput.parse(i))
  .handler(async ({ data, context }) => {
    const roles = await getCallerRoles(context.userId);
    if (!roles.includes("exam_officer") && !roles.includes("super_admin")) throw new Error("Forbidden");
    const { error } = await supabaseAdmin.from("results")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .in("id", data.result_ids).eq("status", "submitted");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const examOfficerPublishResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TransitionInput.parse(i))
  .handler(async ({ data, context }) => {
    const roles = await getCallerRoles(context.userId);
    if (!roles.includes("exam_officer") && !roles.includes("super_admin")) throw new Error("Forbidden");
    const { error } = await supabaseAdmin.from("results")
      .update({ status: "published", published_at: new Date().toISOString() })
      .in("id", data.result_ids).in("status", ["approved", "submitted"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const examOfficerReturnResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TransitionInput.parse(i))
  .handler(async ({ data, context }) => {
    const roles = await getCallerRoles(context.userId);
    if (!roles.includes("exam_officer") && !roles.includes("super_admin")) throw new Error("Forbidden");
    const { error } = await supabaseAdmin.from("results")
      .update({ status: "draft", submitted_at: null, approved_at: null, returned_reason: data.reason ?? null })
      .in("id", data.result_ids).in("status", ["submitted", "approved"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
