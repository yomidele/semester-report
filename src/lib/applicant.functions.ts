import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmissionAccess(userId: string) {
  const { data: roles, error } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(roles ?? []).some((r) => r.role === "super_admin" || r.role === "admission_officer")) {
    throw new Error("Forbidden: admission officer access required");
  }
}

const applicationSchema = z.object({
  full_name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  gender: z.string().max(20).optional(),
  date_of_birth: z.string().optional(),
  address: z.string().max(300).optional(),
  state_of_origin: z.string().max(80).optional(),
  guardian_name: z.string().max(120).optional(),
  guardian_phone: z.string().max(40).optional(),
  previous_school: z.string().max(200).optional(),
  department_id: z.string().uuid(),
  // Required: see PhotoCaptureInput, which already rejects anything that
  // isn't roughly passport-shaped (close, head-and-shoulders) client-side
  // before this ever reaches the server.
  photo_base64: z.string().min(1, "A passport photograph is required"),
});

/** Public: anyone can submit an application for a class from the homepage
 *  /apply form — no account required. This only ever writes `applicants` /
 *  `applications`; it never touches `students` or creates a login. */
export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => applicationSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("college_settings")
      .select("admissions_open")
      .limit(1)
      .maybeSingle();
    if (settingsError) throw new Error(settingsError.message);
    // No settings row yet defaults to open (matches the client's FALLBACK_SETTINGS).
    if (settings && settings.admissions_open === false) {
      throw new Error("Admissions are currently closed. Please check back later or contact the school office.");
    }

    const { data: dept, error: deptError } = await supabaseAdmin
      .from("departments")
      .select("id, is_active")
      .eq("id", data.department_id)
      .maybeSingle();
    if (deptError) throw new Error(deptError.message);
    if (!dept?.is_active) throw new Error("That class is not currently accepting applications");

    const { data: applicant, error: applicantError } = await supabaseAdmin
      .from("applicants")
      .insert({
        full_name: data.full_name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone || null,
        gender: data.gender || null,
        date_of_birth: data.date_of_birth || null,
        address: data.address || null,
        state_of_origin: data.state_of_origin || null,
        qualification: data.previous_school || null,
        guardian_name: data.guardian_name || null,
        guardian_phone: data.guardian_phone || null,
      } as never)
      .select("id, applicant_number")
      .single();
    if (applicantError || !applicant) throw new Error(applicantError?.message ?? "Could not save application");

    // Same upload pattern as enrollStudent (school-admin.functions.ts): the
    // service-role client bypasses storage RLS entirely, which is required
    // here since this function is reachable by anonymous visitors. A failed
    // upload fails the whole application rather than leaving an applicant
    // on record with no photo — see that function's comment for why.
    try {
      const base64 = data.photo_base64.replace(/^data:image\/\w+;base64,/, "");
      const buf = Buffer.from(base64, "base64");
      const fileName = `applicants/${applicant.id}.jpg`;
      const { error: uploadErr } = await supabaseAdmin.storage.from("passports").upload(fileName, buf, { contentType: "image/jpeg", upsert: true });
      if (uploadErr) throw new Error(uploadErr.message);
      const photoUrl = supabaseAdmin.storage.from("passports").getPublicUrl(fileName).data.publicUrl;
      await supabaseAdmin.from("applicants").update({ photo_url: photoUrl } as never).eq("id", applicant.id);
    } catch (e) {
      await supabaseAdmin.from("applicants").delete().eq("id", applicant.id);
      const message = e instanceof Error ? e.message : String(e);
      if (/bucket not found/i.test(message)) {
        throw new Error(
          "Photo upload failed: the \"passports\" storage bucket doesn't exist yet in this Supabase project. " +
            "Run the pending database migrations, then try again.",
        );
      }
      throw new Error(`Photo upload failed: ${message}`);
    }

    const { error: applicationError } = await supabaseAdmin
      .from("applications")
      .insert({ applicant_id: applicant.id, department_id: data.department_id });
    if (applicationError) throw new Error(applicationError.message);

    return { applicant_number: applicant.applicant_number };
  });

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ application_id: z.string().uuid(), status: z.enum(["under_review", "rejected"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmissionAccess(context.userId);
    const { data: current, error: currentError } = await supabaseAdmin
      .from("applications")
      .select("status")
      .eq("id", data.application_id)
      .maybeSingle();
    if (currentError || !current) throw new Error(currentError?.message ?? "Application not found");
    if (current.status === "admitted") throw new Error("This applicant has already been admitted — nothing to change.");

    const { error } = await supabaseAdmin
      .from("applications")
      .update({ status: data.status, reviewed_by: context.userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.application_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Admission Officer only: fetches an application's details to prefill the
 * enrolment form at /admission-officer/enrol?application_id=… There is
 * deliberately no separate "convert applicant to student" function —
 * enrolStudent (src/lib/school-admin.functions.ts) is the ONE place a
 * students row and login get created, for every enrolment whether it started
 * from a public application or was entered directly by the officer. This
 * avoids two divergent code paths (and two different admission-number /
 * account-creation implementations) for what is really the same operation.
 */
export const getApplicationForEnrolment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ application_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmissionAccess(context.userId);
    const { data: application, error } = await supabaseAdmin
      .from("applications")
      .select(
        "id, status, converted_student_id, department_id, applicants(full_name, email, phone, gender, date_of_birth, address, guardian_name, guardian_phone)",
      )
      .eq("id", data.application_id)
      .maybeSingle();
    if (error || !application) throw new Error(error?.message ?? "Application not found");
    if (application.converted_student_id) throw new Error("This applicant has already been admitted.");
    const applicant = Array.isArray(application.applicants) ? application.applicants[0] : application.applicants;
    if (!applicant) throw new Error("Applicant details are missing for this application.");
    return {
      application_id: application.id,
      department_id: application.department_id as string | null,
      full_name: applicant.full_name as string,
      email: applicant.email as string,
      phone: applicant.phone as string | null,
      gender: applicant.gender as string | null,
      date_of_birth: applicant.date_of_birth as string | null,
      address: applicant.address as string | null,
      guardian_name: applicant.guardian_name as string | null,
      guardian_phone: applicant.guardian_phone as string | null,
    };
  });

/** Super Admin OR Admission Officer: the only two roles allowed to flip
 *  public admissions on/off. Writes just this one column via the service
 *  role — see the migration comment for why this isn't a plain RLS grant. */
export const setAdmissionsOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ open: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmissionAccess(context.userId);
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("college_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    const response = existing
      ? await supabaseAdmin.from("college_settings").update({ admissions_open: data.open }).eq("id", existing.id)
      : await supabaseAdmin.from("college_settings").insert({ admissions_open: data.open } as never);
    if (response.error) throw new Error(response.error.message);
    return { ok: true, open: data.open };
  });

/** Admission Officer only: marks the application admitted and links it to
 *  the students row enrolStudent just created. Called right after a
 *  successful enrolment that started from an application — never on its own. */
export const linkApplicationToStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ application_id: z.string().uuid(), student_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmissionAccess(context.userId);
    const { error } = await supabaseAdmin
      .from("applications")
      .update({
        status: "admitted",
        converted_student_id: data.student_id,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.application_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
