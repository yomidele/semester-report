import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Result lifecycle (enforced here, on the server, with the service-role
 * client — the browser can never move a result between these states itself,
 * and the results_validate_write() trigger rejects any attempt to do so
 * directly):
 *
 *   draft ──teacher submits──▶ submitted ──exam officer approves──▶ approved
 *     ▲                            │                                   │
 *     └──── returned for correction ┴───────────────────────────────────┤
 *                                                                       ▼
 *                                                        exam officer publishes
 *                                                                       │
 *   published ──(Exam Officer / Super Admin only, with a written reason)┘
 *   can be returned to draft for correction.
 *
 * "published" is the ONLY state that report cards, result checking by PIN and
 * parent-facing pages may show.
 */

const TransitionInput = z.object({
  result_ids: z.array(z.string().uuid()).min(1).max(2000),
  reason: z.string().trim().max(500).optional(),
});

async function getCaller(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string);
  return {
    roles,
    isTeacher: roles.includes("teacher"),
    isReviewer: roles.includes("exam_officer") || roles.includes("super_admin"),
  };
}

async function audit(userId: string, action: string, ids: string[], details: Record<string, unknown>) {
  // Audit logging must never make a legitimate transition fail.
  try {
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action,
      entity_type: "results",
      entity_id: ids.length === 1 ? ids[0] : null,
      details: { ...details, count: ids.length, result_ids: ids.slice(0, 50) },
    } as never);
  } catch (e) {
    console.error("audit log failed", e);
  }
}

/** Fails unless every id exists AND currently has one of the allowed statuses. */
async function assertAllInStatus(ids: string[], allowed: string[], verb: string) {
  const { data, error } = await supabaseAdmin.from("results").select("id, status").in("id", ids);
  if (error) throw new Error(error.message);
  const found = data ?? [];
  if (found.length !== ids.length) throw new Error("Some of these results no longer exist. Refresh and try again.");
  const wrong = found.filter((r) => !allowed.includes(r.status as string));
  if (wrong.length) {
    throw new Error(
      `${wrong.length} result${wrong.length === 1 ? "" : "s"} cannot be ${verb} from its current status (${[
        ...new Set(wrong.map((r) => r.status)),
      ].join(", ")}). Refresh and try again.`,
    );
  }
}

/**
 * A teacher may only submit results for a subject + class they are assigned to
 * for that exact session and term. Previously any user with the teacher role
 * could submit ANY result id.
 */
async function assertTeacherOwnsResults(userId: string, ids: string[]) {
  const { data: lecturer } = await supabaseAdmin.from("lecturers").select("id").eq("user_id", userId).maybeSingle();
  if (!lecturer) throw new Error("No teacher profile is linked to this account.");

  const { data: results, error } = await supabaseAdmin
    .from("results")
    .select("id, student_id, course_id, session_id, semester")
    .in("id", ids);
  if (error) throw new Error(error.message);
  if ((results ?? []).length !== ids.length) throw new Error("Some of these results no longer exist. Refresh and try again.");

  const studentIds = [...new Set((results ?? []).map((r) => r.student_id))];
  const { data: students } = await supabaseAdmin
    .from("students")
    .select("id, department_id, class_arm_id")
    .in("id", studentIds);
  const studentById = new Map((students ?? []).map((s) => [s.id, s]));

  const { data: assignments } = await supabaseAdmin
    .from("course_assignments")
    .select("course_id, session_id, semester, department_id, class_arm_id")
    .eq("lecturer_id", lecturer.id);

  for (const r of results ?? []) {
    const st = studentById.get(r.student_id);
    const covered = (assignments ?? []).some(
      (a) =>
        a.course_id === r.course_id &&
        a.session_id === r.session_id &&
        a.semester === r.semester &&
        (a.class_arm_id ? a.class_arm_id === st?.class_arm_id : a.department_id === st?.department_id),
    );
    if (!covered) throw new Error("You can only submit results for the subjects and classes assigned to you.");
  }
}

export const lecturerSubmitResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TransitionInput.parse(i))
  .handler(async ({ data, context }) => {
    const caller = await getCaller(context.userId);
    if (!caller.isTeacher) throw new Error("Forbidden");
    await assertTeacherOwnsResults(context.userId, data.result_ids);
    await assertAllInStatus(data.result_ids, ["draft"], "submitted");

    const { error } = await supabaseAdmin
      .from("results")
      .update({ status: "submitted", submitted_at: new Date().toISOString(), returned_reason: null })
      .in("id", data.result_ids)
      .eq("status", "draft");
    if (error) throw new Error(error.message);
    await audit(context.userId, "results_submitted", data.result_ids, {});
    return { ok: true };
  });

export const teacherSubmitResults = lecturerSubmitResults;

export const examOfficerApproveResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TransitionInput.parse(i))
  .handler(async ({ data, context }) => {
    const caller = await getCaller(context.userId);
    if (!caller.isReviewer) throw new Error("Forbidden");
    await assertAllInStatus(data.result_ids, ["submitted"], "approved");

    const { error } = await supabaseAdmin
      .from("results")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .in("id", data.result_ids)
      .eq("status", "submitted");
    if (error) throw new Error(error.message);
    await audit(context.userId, "results_approved", data.result_ids, {});
    return { ok: true };
  });

export const examOfficerPublishResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TransitionInput.parse(i))
  .handler(async ({ data, context }) => {
    const caller = await getCaller(context.userId);
    if (!caller.isReviewer) throw new Error("Forbidden");
    // Publishing is only possible AFTER approval. It used to also accept
    // "submitted", which let an unreviewed result skip verification.
    await assertAllInStatus(data.result_ids, ["approved"], "published");

    const { error } = await supabaseAdmin
      .from("results")
      .update({ status: "published", published_at: new Date().toISOString() })
      .in("id", data.result_ids)
      .eq("status", "approved");
    if (error) throw new Error(error.message);
    await audit(context.userId, "results_published", data.result_ids, {});
    return { ok: true };
  });

export const examOfficerReturnResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TransitionInput.parse(i))
  .handler(async ({ data, context }) => {
    const caller = await getCaller(context.userId);
    if (!caller.isReviewer) throw new Error("Forbidden");
    if (!data.reason || data.reason.length < 5) {
      throw new Error("Please give a reason (at least a few words) so the teacher knows what to correct.");
    }
    // A published result may also be recalled for correction, but always with
    // a reason, and it is recorded in the audit log.
    await assertAllInStatus(data.result_ids, ["submitted", "approved", "published"], "returned");

    const { error } = await supabaseAdmin
      .from("results")
      .update({
        status: "draft",
        submitted_at: null,
        approved_at: null,
        published_at: null,
        returned_reason: data.reason,
      })
      .in("id", data.result_ids)
      .in("status", ["submitted", "approved", "published"]);
    if (error) throw new Error(error.message);
    await audit(context.userId, "results_returned_for_correction", data.result_ids, { reason: data.reason });
    return { ok: true };
  });
