import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { paystackInitialize, paystackVerify, isPaystackConfigured } from "./paystack.server";
import {
  generateSecurePin,
  hashPin,
  verifyPinAgainstHash,
  generatePaymentReference,
  generateVoucherNumber,
  generateVerificationNumber,
} from "./result-pin-crypto.server";
import { generateVoucherPdf } from "./result-pin-voucher-pdf.server";
import { DEFAULT_PIN_SETTINGS, type CollegeSettings, type PinSettings } from "./college-settings";

const VOUCHER_BUCKET = "result-pin-vouchers";
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 10;

// ── shared helpers ──────────────────────────────────────────────────────────

async function getCollegeSettings(): Promise<CollegeSettings> {
  const { data } = await supabaseAdmin.from("college_settings").select("*").limit(1).maybeSingle();
  const pin = { ...DEFAULT_PIN_SETTINGS, ...((data?.pin_settings as Partial<PinSettings>) ?? {}) };
  return { ...(data as unknown as CollegeSettings), pin_settings: pin };
}

async function auditLog(entry: {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  actor_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  details?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("audit_logs").insert({
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id ?? null,
    actor_id: entry.actor_id ?? null,
    actor_email: entry.actor_email ?? null,
    actor_role: entry.actor_role ?? "system",
    details: entry.details ?? {},
  });
}

interface StudentSummary {
  id: string;
  full_name: string;
  matric_number: string;
  level: number;
  programme_name: string | null;
  department_name: string | null;
  faculty_name: string | null;
  email: string | null;
}

async function findStudentByMatric(matricNumber: string): Promise<StudentSummary | null> {
  const { data } = await supabaseAdmin
    .from("students")
    .select("id, full_name, matric_number, level, email, programmes(name), departments(name), faculties(name)")
    .ilike("matric_number", matricNumber.trim())
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    full_name: data.full_name,
    matric_number: data.matric_number,
    level: data.level,
    email: data.email,
    programme_name: (data.programmes as { name: string } | null)?.name ?? null,
    department_name: (data.departments as { name: string } | null)?.name ?? null,
    faculty_name: (data.faculties as { name: string } | null)?.name ?? null,
  };
}

// ── 1 & 2. Student verification before payment ─────────────────────────────

export const verifyStudentForPin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ matric_number: z.string().min(3).max(40) }).parse(input))
  .handler(async ({ data }) => {
    const student = await findStudentByMatric(data.matric_number);
    if (!student) throw new Error("No student record found for that matriculation number.");
    // Deliberately omit email/phone/dob/address — public-facing check.
    const { email: _email, ...safe } = student;
    return safe;
  });

export const getPinPurchaseOptions = createServerFn({ method: "GET" }).handler(async () => {
  const [{ data: sessions }, settings] = await Promise.all([
    supabaseAdmin.from("academic_sessions").select("id, name").order("name", { ascending: false }),
    getCollegeSettings(),
  ]);
  return {
    sessions: sessions ?? [],
    semesters: ["First", "Second"] as const,
    price: settings.pin_settings.price,
    currency: settings.pin_settings.currency,
    paystack_configured: isPaystackConfigured(),
  };
});

// ── 3, 4, 26. Initialize Paystack payment ───────────────────────────────────

const initSchema = z.object({
  matric_number: z.string().min(3).max(40),
  session_id: z.string().uuid(),
  semester: z.enum(["First", "Second"]),
  callback_url: z.string().url(),
});

export const initializePinPurchase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => initSchema.parse(input))
  .handler(async ({ data }) => {
    if (!isPaystackConfigured()) {
      throw new Error("Online payment is not yet configured. Please contact the admissions office.");
    }
    const student = await findStudentByMatric(data.matric_number);
    if (!student) throw new Error("No student record found for that matriculation number.");
    if (!student.email) throw new Error("This student record has no email on file. Contact the registry to add one before purchasing a PIN online.");

    const settings = await getCollegeSettings();
    const price = settings.pin_settings.price;
    const reference = generatePaymentReference();

    const { data: payment, error } = await supabaseAdmin
      .from("result_pin_payments")
      .insert({
        student_id: student.id,
        session_id: data.session_id,
        semester: data.semester,
        amount: price,
        currency: settings.pin_settings.currency,
        reference,
        status: "pending",
      })
      .select("id, reference")
      .single();
    if (error || !payment) throw new Error(error?.message ?? "Could not start payment.");

    await auditLog({
      action: "payment_created",
      entity_type: "result_pin_payment",
      entity_id: payment.id,
      details: { reference, student_matric: student.matric_number, session_id: data.session_id, semester: data.semester },
    });

    const init = await paystackInitialize({
      email: student.email,
      amountKobo: Math.round(price * 100),
      reference,
      callbackUrl: data.callback_url,
      metadata: { payment_id: payment.id, student_id: student.id, purpose: "result_pin" },
    });

    return { authorization_url: init.authorization_url, reference: payment.reference, payment_id: payment.id };
  });

// ── core: verify payment + issue PIN (idempotent) ───────────────────────────
// Shared by the client-side callback page AND the Paystack webhook route.

export async function verifyAndFulfilPinPayment(reference: string) {
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("result_pin_payments")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();
  if (paymentError || !payment) throw new Error("Payment record not found.");

  // Idempotency: already processed — return the existing PIN/voucher, never generate a second one.
  if (payment.status === "successful") {
    const { data: existingPin } = await supabaseAdmin
      .from("result_pins")
      .select("*")
      .eq("payment_id", payment.id)
      .maybeSingle();
    if (existingPin) {
      return { alreadyProcessed: true, pin: existingPin, payment };
    }
    // Payment marked successful but PIN generation previously failed part-way (e.g. PDF step) — retry below without re-charging.
  } else if (payment.status !== "pending") {
    throw new Error(`This payment is marked as ${payment.status} and cannot be fulfilled.`);
  }

  const verification = await paystackVerify(reference);
  if (verification.status !== "success") {
    await supabaseAdmin.from("result_pin_payments").update({
      status: "failed", raw_response: verification as unknown as Record<string, unknown>,
    }).eq("id", payment.id);
    await auditLog({ action: "payment_failed", entity_type: "result_pin_payment", entity_id: payment.id, details: { reference } });
    throw new Error("Payment was not successful.");
  }
  const expectedKobo = Math.round(Number(payment.amount) * 100);
  if (verification.amount !== expectedKobo || verification.currency !== payment.currency) {
    throw new Error("Payment amount mismatch. Please contact support with your payment reference.");
  }

  if (payment.status !== "successful") {
    await supabaseAdmin.from("result_pin_payments").update({
      status: "successful", verified_at: new Date().toISOString(),
      paystack_reference: verification.reference,
      raw_response: verification as unknown as Record<string, unknown>,
    }).eq("id", payment.id);
    await auditLog({ action: "payment_successful", entity_type: "result_pin_payment", entity_id: payment.id, details: { reference } });
  }

  // Re-check for an existing PIN (covers concurrent webhook + callback race).
  const { data: existingPin } = await supabaseAdmin.from("result_pins").select("*").eq("payment_id", payment.id).maybeSingle();
  if (existingPin) return { alreadyProcessed: true, pin: existingPin, payment };

  const [{ data: student }, settings] = await Promise.all([
    supabaseAdmin.from("students").select("*, programmes(name), departments(name)").eq("id", payment.student_id).single(),
    getCollegeSettings(),
  ]);
  if (!student) throw new Error("Student record no longer exists.");

  const rawPin = generateSecurePin();
  const expiresAt = new Date(Date.now() + settings.pin_settings.expiry_days * 86_400_000);

  const { data: pinRow, error: pinError } = await supabaseAdmin
    .from("result_pins")
    .insert({
      student_id: student.id,
      session_id: payment.session_id,
      semester: payment.semester,
      payment_id: payment.id,
      pin_hash: hashPin(rawPin),
      pin_last4: rawPin.slice(-4),
      source: "online",
      status: "active",
      max_views: settings.pin_settings.max_views,
      views_used: 0,
      expires_at: expiresAt.toISOString(),
      activated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (pinError || !pinRow) throw new Error(pinError?.message ?? "Could not generate PIN.");
  await auditLog({ action: "pin_generated", entity_type: "result_pin", entity_id: pinRow.id, details: { student_matric: student.matric_number, source: "online" } });

  const { data: session } = await supabaseAdmin.from("academic_sessions").select("name").eq("id", payment.session_id).single();
  const voucherNumber = generateVoucherNumber();
  const pdfBytes = await generateVoucherPdf({
    voucherNumber,
    pin: rawPin,
    studentName: student.full_name,
    matricOrApplicantRef: student.matric_number,
    programmeName: (student.programmes as { name: string } | null)?.name ?? "\u2014",
    departmentName: (student.departments as { name: string } | null)?.name ?? "\u2014",
    sessionName: session?.name ?? "\u2014",
    semester: payment.semester,
    maxViews: pinRow.max_views,
    expiresAt,
    paymentReference: payment.paystack_reference ?? reference,
    purchaseDate: new Date(),
    college: settings,
  });

  const voucherPath = `${student.id}/${pinRow.id}.pdf`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(VOUCHER_BUCKET)
    .upload(voucherPath, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error(`PIN was generated but the voucher could not be saved: ${uploadError.message}`);

  await supabaseAdmin.from("result_pins").update({ voucher_path: voucherPath }).eq("id", pinRow.id);
  await auditLog({ action: "voucher_generated", entity_type: "result_pin", entity_id: pinRow.id, details: { voucher_number: voucherNumber } });

  const { data: signed } = await supabaseAdmin.storage.from(VOUCHER_BUCKET).createSignedUrl(voucherPath, 60 * 60);

  return {
    alreadyProcessed: false,
    pin: { ...pinRow, voucher_path: voucherPath },
    payment,
    // Only returned on the turn the PIN was actually created — the raw PIN is never stored.
    rawPin,
    voucherUrl: signed?.signedUrl ?? null,
    voucherNumber,
  };
}

export const verifyPinPurchase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ reference: z.string().min(6) }).parse(input))
  .handler(async ({ data }) => {
    const result = await verifyAndFulfilPinPayment(data.reference);
    let voucherUrl = "voucherUrl" in result ? result.voucherUrl : null;
    if (!voucherUrl && result.pin.voucher_path) {
      const { data: signed } = await supabaseAdmin.storage.from(VOUCHER_BUCKET).createSignedUrl(result.pin.voucher_path, 60 * 60);
      voucherUrl = signed?.signedUrl ?? null;
    }
    return {
      status: "successful" as const,
      alreadyProcessed: result.alreadyProcessed,
      voucherUrl,
      pinPreview: "rawPin" in result ? result.rawPin : null, // shown once, only right after generation
      maxViews: result.pin.max_views,
      expiresAt: result.pin.expires_at,
    };
  });

// ── 13 & 14. Public result checking ─────────────────────────────────────────

const checkSchema = z.object({
  matric_number: z.string().min(3).max(40),
  pin: z.string().min(8).max(20),
  session_id: z.string().uuid(),
  semester: z.enum(["First", "Second"]),
});

const GENERIC_INVALID = "The supplied student details or Result PIN are invalid.";

async function recentFailureCount(matricNumber: string): Promise<number> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", "result_check_failed")
    .eq("entity_type", "result_pin_check")
    .gte("created_at", since)
    .contains("details", { matric_number: matricNumber.trim().toUpperCase() });
  return count ?? 0;
}

export const checkResult = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => checkSchema.parse(input))
  .handler(async ({ data }) => {
    const matric = data.matric_number.trim().toUpperCase();

    if ((await recentFailureCount(matric)) >= RATE_LIMIT_MAX_FAILURES) {
      throw new Error("Too many attempts. Please wait a few minutes before trying again.");
    }

    const fail = async (reason: string) => {
      await auditLog({ action: "result_check_failed", entity_type: "result_pin_check", details: { matric_number: matric, reason } });
      throw new Error(GENERIC_INVALID);
    };

    const student = await findStudentByMatric(matric);
    if (!student) return fail("student_not_found");

    const { data: candidates } = await supabaseAdmin
      .from("result_pins")
      .select("*")
      .eq("student_id", student.id)
      .eq("session_id", data.session_id)
      .eq("semester", data.semester);

    const match = (candidates ?? []).find((p) => verifyPinAgainstHash(data.pin, p.pin_hash));
    if (!match) return fail("pin_mismatch");

    if (match.status === "disabled") throw new Error("This PIN has been disabled. Please contact the registry.");
    if (match.status === "expired" || new Date(match.expires_at) < new Date()) {
      if (match.status !== "expired") await supabaseAdmin.from("result_pins").update({ status: "expired" }).eq("id", match.id);
      throw new Error("This Result PIN has expired. Please purchase a new one.");
    }
    if (match.status === "exhausted" || match.views_used >= match.max_views) {
      throw new Error("This Result PIN has reached its maximum number of uses. Please purchase a new one.");
    }

    const { data: results } = await supabaseAdmin
      .from("results")
      .select("*, courses(code, title, unit)")
      .eq("student_id", student.id)
      .eq("session_id", data.session_id)
      .eq("semester", data.semester)
      .eq("status", "published");

    if (!results || results.length === 0) {
      throw new Error("No published result was found for this student in the selected session and semester.");
    }

    const newViewsUsed = match.views_used + 1;
    const newStatus = newViewsUsed >= match.max_views ? "exhausted" : "active";
    await supabaseAdmin
      .from("result_pins")
      .update({ views_used: newViewsUsed, status: newStatus, last_used_at: new Date().toISOString() })
      .eq("id", match.id);

    let verificationNumber = match.verification_number;
    if (!verificationNumber) {
      verificationNumber = generateVerificationNumber();
      await supabaseAdmin.from("result_pins").update({ verification_number: verificationNumber }).eq("id", match.id);
      await supabaseAdmin.from("report_verifications").insert({
        verification_number: verificationNumber,
        student_id: student.id,
        session_id: data.session_id,
        semester: data.semester,
        result_pin_id: match.id,
      });
    }

    await auditLog({
      action: "result_checked",
      entity_type: "result_pin",
      entity_id: match.id,
      details: { student_matric: matric, views_used: newViewsUsed, max_views: match.max_views },
    });

    const { data: session } = await supabaseAdmin.from("academic_sessions").select("name").eq("id", data.session_id).single();

    return {
      student: {
        full_name: student.full_name,
        matric_number: student.matric_number,
        level: student.level,
        programme_name: student.programme_name,
        department_name: student.department_name,
        faculty_name: student.faculty_name,
      },
      session_name: session?.name ?? "",
      semester: data.semester,
      results: (results ?? []).map((r) => ({
        course_code: (r.courses as { code: string } | null)?.code ?? "",
        course_title: (r.courses as { title: string } | null)?.title ?? "",
        unit: (r.courses as { unit: number } | null)?.unit ?? 0,
        ca_score: r.ca_score,
        exam_score: r.exam_score,
        total_score: r.total_score,
      })),
      pin_usage: { views_used: newViewsUsed, max_views: match.max_views, status: newStatus },
      verification_number: verificationNumber,
    };
  });

// ── 11. Student purchase history (logged-in student portal) ────────────────

export const getMyResultPins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: student } = await supabaseAdmin.from("students").select("id").eq("user_id", context.userId).maybeSingle();
    if (!student) throw new Error("No student record linked to this account.");
    const { data: pins } = await supabaseAdmin
      .from("result_pins")
      .select("id, session_id, semester, status, max_views, views_used, created_at, expires_at, voucher_path, academic_sessions(name)")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false });
    return (pins ?? []).map((p) => ({
      id: p.id,
      session_name: (p.academic_sessions as { name: string } | null)?.name ?? "",
      semester: p.semester,
      status: p.status,
      max_views: p.max_views,
      views_used: p.views_used,
      created_at: p.created_at,
      expires_at: p.expires_at,
      has_voucher: Boolean(p.voucher_path),
    }));
  });

export const getMyVoucherDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pin_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: student } = await supabaseAdmin.from("students").select("id").eq("user_id", context.userId).maybeSingle();
    if (!student) throw new Error("No student record linked to this account.");
    const { data: pin } = await supabaseAdmin.from("result_pins").select("student_id, voucher_path").eq("id", data.pin_id).maybeSingle();
    if (!pin || pin.student_id !== student.id) throw new Error("Voucher not found."); // never reveal another student's voucher exists
    if (!pin.voucher_path) throw new Error("Voucher is not available yet.");
    const { data: signed, error } = await supabaseAdmin.storage.from(VOUCHER_BUCKET).createSignedUrl(pin.voucher_path, 60 * 10);
    if (error || !signed) throw new Error("Could not generate a download link. Please try again.");
    await auditLog({ action: "voucher_downloaded", entity_type: "result_pin", entity_id: data.pin_id, actor_id: context.userId });
    return { url: signed.signedUrl };
  });

// ── 18. Public authenticity verification (QR target) ───────────────────────

export const verifyResultDocument = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ code: z.string().min(4).max(40) }).parse(input))
  .handler(async ({ data }) => {
    const { data: record } = await supabaseAdmin
      .from("report_verifications")
      .select("verification_number, semester, generated_at, students(full_name, matric_number, programmes(name)), academic_sessions(name)")
      .eq("verification_number", data.code.trim().toUpperCase())
      .maybeSingle();
    if (!record) return { valid: false as const };
    const student = record.students as { full_name: string; matric_number: string; programmes: { name: string } | null } | null;
    return {
      valid: true as const,
      verification_number: record.verification_number,
      student_name: student?.full_name ?? "",
      programme_name: student?.programmes?.name ?? "",
      session_name: (record.academic_sessions as { name: string } | null)?.name ?? "",
      semester: record.semester,
      generated_at: record.generated_at,
    };
  });

// ── 19–21. Admin: dashboard, listing, manual issuance ───────────────────────

async function requireAdmin(userId: string) {
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "faculty_admin", "dept_admin"])
    .maybeSingle();
  if (!role) throw new Error("Forbidden: admin access required.");
}

export const adminGetPinStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const [{ count: total }, { count: active }, { count: exhausted }, { count: expired }, { count: disabled }, { count: manual }, { data: payments }] =
      await Promise.all([
        supabaseAdmin.from("result_pins").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("result_pins").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabaseAdmin.from("result_pins").select("id", { count: "exact", head: true }).eq("status", "exhausted"),
        supabaseAdmin.from("result_pins").select("id", { count: "exact", head: true }).eq("status", "expired"),
        supabaseAdmin.from("result_pins").select("id", { count: "exact", head: true }).eq("status", "disabled"),
        supabaseAdmin.from("result_pins").select("id", { count: "exact", head: true }).eq("source", "manual"),
        supabaseAdmin.from("result_pin_payments").select("amount").eq("status", "successful"),
      ]);
    const totalRevenue = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    return {
      total: total ?? 0, active: active ?? 0, exhausted: exhausted ?? 0, expired: expired ?? 0,
      disabled: disabled ?? 0, manual: manual ?? 0, online: (total ?? 0) - (manual ?? 0), totalRevenue,
    };
  });

export const adminListResultPins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("result_pins")
      .select("id, semester, status, source, max_views, views_used, created_at, expires_at, pin_last4, students(full_name, matric_number), academic_sessions(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((p) => ({
      id: p.id,
      student_name: (p.students as { full_name: string } | null)?.full_name ?? "",
      matric_number: (p.students as { matric_number: string } | null)?.matric_number ?? "",
      session_name: (p.academic_sessions as { name: string } | null)?.name ?? "",
      semester: p.semester,
      status: p.status,
      source: p.source,
      views: `${p.views_used}/${p.max_views}`,
      pin_last4: p.pin_last4,
      created_at: p.created_at,
      expires_at: p.expires_at,
    }));
  });

export const adminListPinPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("result_pin_payments")
      .select("id, amount, reference, status, semester, created_at, students(full_name, matric_number), academic_sessions(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((p) => ({
      id: p.id,
      student_name: (p.students as { full_name: string } | null)?.full_name ?? "",
      matric_number: (p.students as { matric_number: string } | null)?.matric_number ?? "",
      amount: p.amount,
      reference: p.reference,
      status: p.status,
      session_name: (p.academic_sessions as { name: string } | null)?.name ?? "",
      semester: p.semester,
      created_at: p.created_at,
    }));
  });

const manualSchema = z.object({ matric_number: z.string().min(3), session_id: z.string().uuid(), semester: z.enum(["First", "Second"]) });

export const adminGenerateManualPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => manualSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const student = await findStudentByMatric(data.matric_number);
    if (!student) throw new Error("No student record found for that matriculation number.");

    const settings = await getCollegeSettings();
    const rawPin = generateSecurePin();
    const expiresAt = new Date(Date.now() + settings.pin_settings.expiry_days * 86_400_000);

    const { data: pinRow, error } = await supabaseAdmin
      .from("result_pins")
      .insert({
        student_id: student.id, session_id: data.session_id, semester: data.semester,
        pin_hash: hashPin(rawPin), pin_last4: rawPin.slice(-4), source: "manual", issued_by: context.userId,
        status: "active", max_views: settings.pin_settings.max_views, views_used: 0,
        expires_at: expiresAt.toISOString(), activated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error || !pinRow) throw new Error(error?.message ?? "Could not generate PIN.");
    await auditLog({ action: "pin_manually_generated", entity_type: "result_pin", entity_id: pinRow.id, actor_id: context.userId, details: { student_matric: student.matric_number } });

    const { data: fullStudent } = await supabaseAdmin.from("students").select("*, programmes(name), departments(name)").eq("id", student.id).single();
    const { data: session } = await supabaseAdmin.from("academic_sessions").select("name").eq("id", data.session_id).single();
    const voucherNumber = generateVoucherNumber();
    const pdfBytes = await generateVoucherPdf({
      voucherNumber, pin: rawPin,
      studentName: student.full_name, matricOrApplicantRef: student.matric_number,
      programmeName: (fullStudent?.programmes as { name: string } | null)?.name ?? "\u2014",
      departmentName: (fullStudent?.departments as { name: string } | null)?.name ?? "\u2014",
      sessionName: session?.name ?? "\u2014", semester: data.semester,
      maxViews: pinRow.max_views, expiresAt, paymentReference: "MANUAL \u2014 ISSUED BY ADMIN",
      purchaseDate: new Date(), college: settings,
    });
    const voucherPath = `${student.id}/${pinRow.id}.pdf`;
    await supabaseAdmin.storage.from(VOUCHER_BUCKET).upload(voucherPath, pdfBytes, { contentType: "application/pdf", upsert: true });
    await supabaseAdmin.from("result_pins").update({ voucher_path: voucherPath }).eq("id", pinRow.id);
    const { data: signed } = await supabaseAdmin.storage.from(VOUCHER_BUCKET).createSignedUrl(voucherPath, 60 * 30);

    return { pin: rawPin, voucherUrl: signed?.signedUrl ?? null, voucherNumber, studentName: student.full_name };
  });

// ── 22. Disable a PIN (refund/reversal handling) ────────────────────────────

export const adminDisablePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pin_id: z.string().uuid(), reason: z.string().min(3).max(300) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await supabaseAdmin.from("result_pins").update({ status: "disabled" }).eq("id", data.pin_id);
    await auditLog({ action: "pin_disabled", entity_type: "result_pin", entity_id: data.pin_id, actor_id: context.userId, details: { reason: data.reason } });
    return { ok: true };
  });
