import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const applicationSchema = z.object({
  full_name: z.string().min(2).max(120), email: z.string().email(), phone: z.string().max(30).optional(),
  gender: z.string().max(20).optional(), date_of_birth: z.string().optional(), address: z.string().max(300).optional(),
  state_of_origin: z.string().max(80).optional(), qualification: z.string().max(200).optional(), programme_id: z.string().uuid(),
});

export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => applicationSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: programme, error: programmeError } = await supabaseAdmin.from("programmes").select("id, is_active").eq("id", data.programme_id).maybeSingle();
    if (programmeError) throw new Error(programmeError.message);
    if (!programme?.is_active) throw new Error("That programme is not currently accepting applications");
    const { data: applicant, error: applicantError } = await supabaseAdmin.from("applicants").insert({
      full_name: data.full_name.trim(), email: data.email.trim().toLowerCase(), phone: data.phone || null, gender: data.gender || null,
      date_of_birth: data.date_of_birth || null, address: data.address || null, state_of_origin: data.state_of_origin || null,
      qualification: data.qualification || null,
    }).select("id, applicant_number").single();
    if (applicantError || !applicant) throw new Error(applicantError?.message ?? "Could not save application");
    const { error: applicationError } = await supabaseAdmin.from("applications").insert({ applicant_id: applicant.id, programme_id: data.programme_id });
    if (applicationError) throw new Error(applicationError.message);
    return { applicant_number: applicant.applicant_number };
  });

export const convertApplicationToStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ application_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: role, error: roleError } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "super_admin").maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!role) throw new Error("Forbidden: super admin only");
    const { data: application, error: applicationError } = await supabaseAdmin
      .from("applications").select("id, applicant_id, programme_id, converted_student_id").eq("id", data.application_id).maybeSingle();
    if (applicationError || !application) throw new Error(applicationError?.message ?? "Application not found");
    if (application.converted_student_id) throw new Error("This application has already been converted");
    const [{ data: applicant, error: applicantError }, { data: programme, error: programmeError }] = await Promise.all([
      supabaseAdmin.from("applicants").select("*").eq("id", application.applicant_id).single(),
      supabaseAdmin.from("programmes").select("id, faculty_id, department_id").eq("id", application.programme_id).single(),
    ]);
    if (applicantError || !applicant) throw new Error(applicantError?.message ?? "Applicant not found");
    if (programmeError || !programme) throw new Error(programmeError?.message ?? "Programme not found");
    const [{ data: faculty }, { data: department }, { data: settings }] = await Promise.all([
      supabaseAdmin.from("faculties").select("code").eq("id", programme.faculty_id).single(),
      supabaseAdmin.from("departments").select("code").eq("id", programme.department_id).single(),
      supabaseAdmin.from("college_settings").select("matric_format, matric_seq_padding").limit(1).maybeSingle(),
    ]);
    const yearCode = String(new Date().getFullYear()).slice(-2);
    const { data: sequence, error: sequenceError } = await supabaseAdmin.rpc("next_matric_seq", { _department_id: programme.department_id, _year_code: yearCode });
    if (sequenceError || typeof sequence !== "number") throw new Error(sequenceError?.message ?? "Could not allocate matric number");
    const sequenceText = String(sequence).padStart(settings?.matric_seq_padding ?? 4, "0");
    const matricNumber = (settings?.matric_format ?? "{DEPT}/{YY}/{SEQ}")
      .replaceAll("{FAC}", (faculty?.code ?? "FAC").toUpperCase()).replaceAll("{DEPT}", (department?.code ?? "DEPT").toUpperCase())
      .replaceAll("{YY}", yearCode).replaceAll("{SEQ}", sequenceText);
    const temporaryPassword = `Kz${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}!`;
    const { data: created, error: userError } = await supabaseAdmin.auth.admin.createUser({ email: applicant.email, password: temporaryPassword, email_confirm: true, user_metadata: { full_name: applicant.full_name, matric_number: matricNumber } });
    if (userError || !created.user) throw new Error(userError?.message ?? "Could not create student account");
    const studentRow = { user_id: created.user.id, matric_number: matricNumber, full_name: applicant.full_name, email: applicant.email, phone: applicant.phone, faculty_id: programme.faculty_id, department_id: programme.department_id, programme_id: programme.id, gender: applicant.gender, date_of_birth: applicant.date_of_birth, address: applicant.address, state_of_origin: applicant.state_of_origin };
    const { data: student, error: studentError } = await supabaseAdmin.from("students").insert(studentRow as never).select("id").single();
    if (studentError || !student) { await supabaseAdmin.auth.admin.deleteUser(created.user.id); throw new Error(studentError?.message ?? "Could not create student record"); }
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "student" });
    const { error: linkError } = await supabaseAdmin.from("applications").update({ status: "admitted", converted_student_id: student.id, reviewed_at: new Date().toISOString() }).eq("id", application.id);
    if (linkError) throw new Error(linkError.message);
    return { matric_number: matricNumber, temporary_password: temporaryPassword };
  });
