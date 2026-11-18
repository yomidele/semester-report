import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Server side of Student Promotion (/admin/promotions) and term completion
// (/sessions). The rules themselves live in the database (migration
// 20261117100000): promotion_candidates(), run_promotion() and
// reverse_promotion() — these functions only check who is asking and pass
// the request on, so the same rules apply however promotion is triggered.

// The new columns/functions aren't in the generated Supabase types yet.
const db = supabaseAdmin as any;

async function assertRole(userId: string, roles: string[]) {
  const { data, error } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r) => roles.includes(r.role as string))) {
    throw new Error("You don't have permission to do this.");
  }
}

function friendly(error: { message: string } | null) {
  if (!error) return;
  if (/function .*(promotion_candidates|run_promotion|reverse_promotion)|column .*(term_completed_at|closed_at|promotion_settings)/i.test(error.message)) {
    throw new Error("The promotion system isn't set up in the database yet. Run the term-completion and promotion SQL in Supabase first.");
  }
  throw new Error(error.message);
}

async function audit(actor: string, action: string, entityId: string | null, details: unknown) {
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: actor,
    action,
    entity_type: "promotion",
    entity_id: entityId,
    details,
  } as never);
}

export type PromotionAction = "promote" | "special" | "repeat" | "complete" | "review" | "done";

export type PromotionCandidate = {
  student_id: string;
  full_name: string;
  matric_number: string | null;
  from_department_id: string | null;
  from_department_name: string | null;
  from_class_arm_id: string | null;
  from_arm_name: string | null;
  from_arm_code: string | null;
  to_department_id: string | null;
  to_department_name: string | null;
  to_class_arm_id: string | null;
  to_arm_name: string | null;
  to_arm_code: string | null;
  action: PromotionAction;
  reason: string | null;
};

export type SessionProgress = {
  id: string;
  name: string;
  created_at: string;
  first_term_completed_at: string | null;
  second_term_completed_at: string | null;
  third_term_completed_at: string | null;
  closed_at: string | null;
};

export type PromotionHistoryRow = {
  id: string;
  student_id: string;
  outcome: string;
  status: string;
  created_at: string;
  exception_note: string | null;
  reversal_reason: string | null;
  reversed_at: string | null;
  performed_by_label: string;
  student: { full_name: string; matric_number: string | null } | null;
  from_dept: { name: string } | null;
  to_dept: { name: string } | null;
  from_arm: { name: string; code: string | null } | null;
  to_arm: { name: string; code: string | null } | null;
  to_session: { name: string } | null;
};

const SESSION_COLUMNS = "id, name, created_at, first_term_completed_at, second_term_completed_at, third_term_completed_at, closed_at";

export const listSessionProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.userId, ["super_admin", "exam_officer"]);
    const { data, error } = await db.from("academic_sessions").select(SESSION_COLUMNS).order("name", { ascending: false });
    friendly(error);
    return (data ?? []) as SessionProgress[];
  });

// Mark a term complete (or undo it) and close / reopen a session. The
// database enforces the order First → Second → Third → Closed.
export const updateSessionProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      session_id: z.string().uuid(),
      step: z.enum(["first", "second", "third", "close"]),
      done: z.boolean(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin", "exam_officer"]);
    const column = {
      first: "first_term_completed_at",
      second: "second_term_completed_at",
      third: "third_term_completed_at",
      close: "closed_at",
    }[data.step];

    if (!data.done && (data.step === "close" || data.step === "third")) {
      const { count } = await db
        .from("student_class_history")
        .select("id", { count: "exact", head: true })
        .eq("from_session_id", data.session_id)
        .eq("status", "applied");
      if ((count ?? 0) > 0) {
        throw new Error("Pupils have already been promoted from this session. Reverse those promotions before reopening it.");
      }
    }

    const patch: Record<string, unknown> = { [column]: data.done ? new Date().toISOString() : null };
    if (data.step === "close") patch.closed_by = data.done ? context.userId : null;

    const { error } = await db.from("academic_sessions").update(patch).eq("id", data.session_id);
    if (error) {
      if (/term_order_check/.test(error.message)) {
        throw new Error(
          data.done
            ? "Complete the terms in order: First, then Second, then Third, then close the session."
            : "Undo the later steps first (reopen the session, then the Third Term, then the Second).",
        );
      }
      friendly(error);
    }
    await audit(context.userId, data.done ? `session_${data.step}_completed` : `session_${data.step}_reopened`, data.session_id, null);
    return { ok: true as const };
  });

export const getPromotionOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ from_session_id: z.string().uuid().nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);

    const [{ data: sessions, error: sErr }, { count: activeCount }, { data: settingsRow, error: setErr }, { data: departments }] =
      await Promise.all([
        db.from("academic_sessions").select(SESSION_COLUMNS).order("name", { ascending: false }),
        supabaseAdmin.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
        db.from("college_settings").select("promotion_settings").limit(1).maybeSingle(),
        supabaseAdmin.from("departments").select("id, name, next_department_id").order("name"),
      ]);
    friendly(sErr);
    friendly(setErr);

    let candidates: PromotionCandidate[] = [];
    let history: PromotionHistoryRow[] = [];
    if (data.from_session_id) {
      const { data: rows, error } = await db.rpc("promotion_candidates", { _from_session: data.from_session_id });
      friendly(error);
      candidates = (rows ?? []) as PromotionCandidate[];

      const { data: hist, error: hErr } = await db
        .from("student_class_history")
        .select(
          "id, student_id, outcome, status, created_at, exception_note, reversal_reason, reversed_at, performed_by, " +
            "student:students(full_name, matric_number), " +
            "from_dept:departments!student_class_history_from_department_id_fkey(name), " +
            "to_dept:departments!student_class_history_to_department_id_fkey(name), " +
            "from_arm:class_arms!student_class_history_from_class_arm_id_fkey(name, code), " +
            "to_arm:class_arms!student_class_history_to_class_arm_id_fkey(name, code), " +
            "to_session:academic_sessions!student_class_history_session_id_fkey(name)",
        )
        .eq("from_session_id", data.from_session_id)
        .order("created_at", { ascending: false });
      friendly(hErr);

      const performerIds = [...new Set(((hist ?? []) as any[]).map((h) => h.performed_by).filter(Boolean))] as string[];
      const labels = new Map<string, string>();
      await Promise.all(
        performerIds.map(async (id) => {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
          labels.set(id, u?.user?.email ?? "Administrator");
        }),
      );
      history = ((hist ?? []) as any[]).map((h) => ({
        ...h,
        performed_by_label: h.performed_by ? labels.get(h.performed_by) ?? "Administrator" : "System",
      }));
    }

    return {
      sessions: (sessions ?? []) as SessionProgress[],
      activeCount: activeCount ?? 0,
      policy: {
        require_results_all_terms: settingsRow?.promotion_settings?.require_results_all_terms ?? true,
        min_average: settingsRow?.promotion_settings?.min_average ?? null,
      } as { require_results_all_terms: boolean; min_average: number | null },
      departments: (departments ?? []) as { id: string; name: string; next_department_id: string | null }[],
      candidates,
      history,
    };
  });

export const savePromotionPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      require_results_all_terms: z.boolean(),
      min_average: z.number().min(0).max(100).nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    const { data: row } = await supabaseAdmin.from("college_settings").select("id").limit(1).maybeSingle();
    if (!row) throw new Error("School settings not found");
    const { error } = await db.from("college_settings").update({ promotion_settings: data }).eq("id", row.id);
    friendly(error);
    await audit(context.userId, "promotion_policy_updated", null, data);
    return { ok: true as const };
  });

export const runPromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      from_session_id: z.string().uuid(),
      to_session_id: z.string().uuid(),
      decisions: z.record(z.string().uuid(), z.enum(["promote", "repeat", "complete", "skip"])).default({}),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    const { data: summary, error } = await db.rpc("run_promotion", {
      _from_session: data.from_session_id,
      _to_session: data.to_session_id,
      _actor: context.userId,
      _decisions: data.decisions,
    });
    friendly(error);
    await audit(context.userId, "promotion_run", data.from_session_id, { to_session_id: data.to_session_id, summary });
    return summary as {
      promoted: number; special: number; repeated: number; completed: number;
      skipped: number; already: number; awaiting_arm: number;
    };
  });

export const reversePromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ history_id: z.string().uuid(), reason: z.string().trim().min(5).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    const { data: res, error } = await db.rpc("reverse_promotion", {
      _history_id: data.history_id,
      _actor: context.userId,
      _reason: data.reason,
    });
    friendly(error);
    await audit(context.userId, "promotion_reversed", data.history_id, { reason: data.reason, ...(res ?? {}) });
    return res as { full_name: string };
  });

// Approved special promotion: send this pupil to a specific class at the
// next promotion (e.g. a double promotion), with the reason on record.
export const setSpecialPromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      student_id: z.string().uuid(),
      department_id: z.string().uuid().nullable(),
      note: z.string().trim().max(300).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    if (data.department_id && !data.note) throw new Error("Record who approved the special promotion and why.");
    const { error } = await db
      .from("students")
      .update({
        promotion_override_department_id: data.department_id,
        promotion_override_note: data.department_id ? data.note : null,
      })
      .eq("id", data.student_id);
    friendly(error);
    await audit(context.userId, data.department_id ? "special_promotion_set" : "special_promotion_cleared", data.student_id, data);
    return { ok: true as const };
  });
