import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertRole(userId: string, roles: string[]) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const has = (data ?? []).some((r) => roles.includes(r.role as string));
  if (!has) throw new Error(`Forbidden: requires one of [${roles.join(", ")}]`);
}

// ---------------------------------------------------------------------------
// Exam officer accounts (super_admin only can create these)
// ---------------------------------------------------------------------------
export const createExamOfficer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
        full_name: z.string().min(1).max(255),
        phone: z.string().max(40).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    const { data: created, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (signUpError || !created?.user) throw new Error(signUpError?.message ?? "Failed to create user");
    const userId = created.user.id;
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "exam_officer" });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error(`Role assignment failed: ${roleError.message}`);
    }
    return { user_id: userId };
  });

export const deleteExamOfficer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "exam_officer");
    await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Admission officer accounts (super_admin only can create these)
// ---------------------------------------------------------------------------
export const createAdmissionOfficer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
        full_name: z.string().min(1).max(255),
        phone: z.string().max(40).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    const { data: created, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (signUpError || !created?.user) throw new Error(signUpError?.message ?? "Failed to create user");
    const userId = created.user.id;
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admission_officer" });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error(`Role assignment failed: ${roleError.message}`);
    }
    return { user_id: userId };
  });

export const deleteAdmissionOfficer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "admission_officer");
    await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Classes & arms (exam officer + super admin)
// ---------------------------------------------------------------------------
export const createClassLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        faculty_id: z.string().uuid(),
        name: z.string().min(1).max(120),
        code: z.string().min(1).max(30),
        description: z.string().max(500).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    const { data: dept, error } = await supabaseAdmin
      .from("departments")
      .insert({
        faculty_id: data.faculty_id,
        name: data.name,
        code: data.code.toUpperCase(),
        is_active: true,
        description: data.description ?? null,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: dept.id };
  });

export const createClassArm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        department_id: z.string().uuid(),
        name: z.string().min(1).max(60),
        code: z.string().min(1).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    const { data: arm, error } = await supabaseAdmin
      .from("class_arms")
      .insert({ department_id: data.department_id, name: data.name, code: data.code.toUpperCase() } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: arm.id };
  });

export const assignFormMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        class_arm_id: z.string().uuid(),
        lecturer_id: z.string().uuid().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    if (data.lecturer_id) {
      const { data: teacher, error: teacherError } = await supabaseAdmin
        .from("lecturers")
        .select("user_id")
        .eq("id", data.lecturer_id)
        .maybeSingle();
      if (teacherError) throw new Error(teacherError.message);
      if (!teacher) throw new Error("Form Master must be an existing teacher");
      const { data: teacherRole, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("user_id", teacher.user_id)
        .eq("role", "teacher")
        .maybeSingle();
      if (roleError) throw new Error(roleError.message);
      if (!teacherRole) throw new Error("Only users with the Teacher role can be assigned as Form Master");
    }
    const { error } = await supabaseAdmin
      .from("class_arms")
      .update({ form_teacher_id: data.lecturer_id } as never)
      .eq("id", data.class_arm_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setStudentRepeatFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ student_id: z.string().uuid(), repeat_flag: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    const { error } = await supabaseAdmin.from("students").update({ repeat_flag: data.repeat_flag } as never).eq("id", data.student_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setNextClassLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ department_id: z.string().uuid(), next_department_id: z.string().uuid().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    if (data.next_department_id === data.department_id) throw new Error("A class cannot come after itself");
    const { error } = await supabaseAdmin
      .from("departments")
      .update({ next_department_id: data.next_department_id } as never)
      .eq("id", data.department_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Enrol a pupil (admission officer + super admin). Unlike the old public
// "apply to the college" flow, this is staff-entered: no application review
// step, no payment, the officer keys in the child's details and the
// account plus admission number are created immediately so a letter can be
// generated straight away.
// ---------------------------------------------------------------------------
export const enrollStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        full_name: z.string().min(2).max(120),
        email: z.string().email(),
        gender: z.enum(["Male", "Female", "Other"]).optional().nullable(),
        date_of_birth: z.string().optional().nullable(),
        address: z.string().max(500).optional().nullable(),
        guardian_name: z.string().max(120).optional().nullable(),
        guardian_phone: z.string().max(40).optional().nullable(),
        faculty_id: z.string().uuid(),
        department_id: z.string().uuid(),
        class_arm_id: z.string().uuid().optional().nullable(),
        // Required: every pupil enrolled through this single-entry form must
        // have a passport photograph on file (captured live via the device
        // camera or uploaded from a file) — see PhotoCaptureInput on the
        // enrol page. Bulk-add (a plain class-list import with no photos
        // available at entry time) intentionally goes through a separate
        // function and is not affected by this requirement.
        passport_base64: z.string().min(1, "A passport photograph is required"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin", "admission_officer"]);

    const { data: dept, error: deptErr } = await supabaseAdmin
      .from("departments")
      .select("id, code, faculty_id")
      .eq("id", data.department_id)
      .maybeSingle();
    if (deptErr) throw new Error(deptErr.message);
    if (!dept || dept.faculty_id !== data.faculty_id) {
      throw new Error("Selected class does not belong to the selected section");
    }

    // Reuse the same atomic sequence + format used for student self-registration,
    // so admission numbers and self-registered matric numbers never collide.
    const yearCode = String(new Date().getFullYear()).slice(-2);
    const deptCode = (dept.code ?? "PRI").toUpperCase();
    const { data: seq, error: seqErr } = await supabaseAdmin.rpc("next_matric_seq", {
      _department_id: data.department_id,
      _year_code: yearCode,
    });
    if (seqErr || typeof seq !== "number") throw new Error(seqErr?.message ?? "Could not allocate an admission number");

    const { data: settings } = await supabaseAdmin
      .from("college_settings")
      .select("matric_format, matric_seq_padding, college_name, short_name, address, city, state, motto, logo_url")
      .limit(1)
      .maybeSingle();
    const matricFormat = settings?.matric_format ?? "{DEPT}/{YY}/{SEQ}";
    const sequence = String(seq).padStart(settings?.matric_seq_padding ?? 4, "0");
    const admissionNumber = matricFormat
      .replaceAll("{FAC}", "PRI")
      .replaceAll("{DEPT}", deptCode)
      .replaceAll("{CLASS}", deptCode)
      .replaceAll("{YY}", yearCode)
      .replaceAll("{SEQ}", sequence);

    const temporaryPassword = `Sch${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}!`;
    const { data: created, error: signUpErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, matric_number: admissionNumber },
    });
    if (signUpErr || !created.user) throw new Error(signUpErr?.message ?? "Failed to create the pupil's account");
    const userId = created.user.id;

    // Passport photo is mandatory (validated above) — an upload failure here
    // means the pupil would end up on record with no photograph at all, so
    // this fails the whole enrolment (and rolls back the auth account just
    // created) rather than silently continuing, like the students-insert
    // failure path just below already does for the same reason.
    let passportUrl: string;
    try {
      const base64 = data.passport_base64.replace(/^data:image\/\w+;base64,/, "");
      const buf = Buffer.from(base64, "base64");
      const fileName = `${userId}/passport.jpg`;
      const { error: uploadErr } = await supabaseAdmin.storage.from("passports").upload(fileName, buf, { contentType: "image/jpeg", upsert: true });
      if (uploadErr) throw new Error(uploadErr.message);
      passportUrl = supabaseAdmin.storage.from("passports").getPublicUrl(fileName).data.publicUrl;
    } catch (e) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      const message = e instanceof Error ? e.message : String(e);
      if (/bucket not found/i.test(message)) {
        throw new Error(
          "Passport photo upload failed: the \"passports\" storage bucket doesn't exist yet in this Supabase project. " +
            "Run the pending database migrations, or open the Supabase SQL Editor and run the storage.buckets insert " +
            "from supabase/migrations/20260927150000_school_logo_and_passport_buckets.sql.",
        );
      }
      throw new Error(`Passport photo upload failed: ${message}`);
    }

    // Primary pupils don't have a "level" the way college students do
    // (100/200/300...); level is kept for schema compatibility with the
    // shared results/transcript code and is not shown to primary users.
    const admissionDate = new Date().toISOString();
    const studentRow = {
      user_id: userId,
      matric_number: admissionNumber,
      full_name: data.full_name,
      email: data.email,
      phone: null,
      level: 1,
      faculty_id: data.faculty_id,
      department_id: data.department_id,
      class_arm_id: data.class_arm_id ?? null,
      gender: data.gender ?? null,
      date_of_birth: data.date_of_birth ?? null,
      address: data.address ?? null,
      guardian_name: data.guardian_name ?? null,
      guardian_phone: data.guardian_phone ?? null,
      passport_url: passportUrl,
      admission_date: admissionDate,
    };
    const { error: studentErr } = await supabaseAdmin.from("students").insert(studentRow as never);
    if (studentErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error(studentErr.message);
    }


    return {
      ok: true as const,
      admission_number: admissionNumber,
      full_name: data.full_name,
      admission_date: admissionDate,
      temporary_password: temporaryPassword,
      school: {
        name: settings?.college_name ?? "the school",
        short_name: settings?.short_name ?? "",
        address: settings?.address ?? "",
        city: settings?.city ?? "",
        state: settings?.state ?? "",
        motto: settings?.motto ?? "",
        logo_url: settings?.logo_url ?? null,
      },
    };
  });

// ---------------------------------------------------------------------------
// Bulk-enrol a whole class at once from a plain list of names (e.g. copied
// from a class register photo). Unlike enrollStudent, this does NOT create a
// login account for each pupil, most class lists are just names, with no
// parent email available at the time of entry. Each pupil still gets a real
// admission number and a students row, so they immediately show up in
// rosters, teacher assignments, and report sheets. A login can be added for
// an individual pupil later (once a parent email is available) by re-running
// the single enrol flow's account-creation step, not built in this pass.
// ---------------------------------------------------------------------------
export const bulkEnrollStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        faculty_id: z.string().uuid(),
        department_id: z.string().uuid(),
        class_arm_id: z.string().uuid().optional().nullable(),
        full_names: z.array(z.string().min(1).max(120)).min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin", "admission_officer"]);

    const { data: dept, error: deptErr } = await supabaseAdmin
      .from("departments")
      .select("id, code, faculty_id")
      .eq("id", data.department_id)
      .maybeSingle();
    if (deptErr) throw new Error(deptErr.message);
    if (!dept || dept.faculty_id !== data.faculty_id) {
      throw new Error("Selected class does not belong to the selected section");
    }

    const { data: settings } = await supabaseAdmin
      .from("college_settings")
      .select("matric_format, matric_seq_padding")
      .limit(1)
      .maybeSingle();
    const matricFormat = settings?.matric_format ?? "{CLASS}/{YY}/{SEQ}";
    const yearCode = String(new Date().getFullYear()).slice(-2);
    const deptCode = (dept.code ?? "PRI").toUpperCase();

    const results: { full_name: string; admission_number: string; admission_date: string }[] = [];
    const failures: { full_name: string; reason: string }[] = [];

    // Sequential, not parallel: next_matric_seq must be awaited one at a time
    // so each pupil gets a distinct, gap-free sequence number. Even so, a
    // duplicate admission number can still happen — e.g. a pupil in this
    // class was added through a different path before (manual single-add,
    // a re-run of this same list, a seeded demo record) whose number isn't
    // reflected in next_matric_seq's counter. Rather than let one collision
    // abort the whole class list (previously: everyone after the colliding
    // name silently never got added), retry that one name with a fresh
    // number a few times, and only give up on that single pupil — the rest
    // of the list still goes through.
    for (const rawName of data.full_names) {
      const full_name = rawName.trim();
      if (!full_name) continue;

      let lastError: string | null = null;
      let added = false;

      for (let attempt = 0; attempt < 5 && !added; attempt++) {
        const { data: seq, error: seqErr } = await supabaseAdmin.rpc("next_matric_seq", {
          _department_id: data.department_id,
          _year_code: yearCode,
        });
        if (seqErr || typeof seq !== "number") {
          lastError = seqErr?.message ?? "Could not allocate an admission number";
          break;
        }

        const sequence = String(seq).padStart(settings?.matric_seq_padding ?? 4, "0");
        const admissionNumber = matricFormat
          .replaceAll("{FAC}", "PRI")
          .replaceAll("{DEPT}", deptCode)
          .replaceAll("{CLASS}", deptCode)
          .replaceAll("{YY}", yearCode)
          .replaceAll("{SEQ}", sequence);

        const admissionDate = new Date().toISOString();
        const { error: insertErr } = await supabaseAdmin.from("students").insert({
          user_id: null,
          matric_number: admissionNumber,
          full_name,
          email: null,
          level: 1,
          faculty_id: data.faculty_id,
          department_id: data.department_id,
          class_arm_id: data.class_arm_id ?? null,
          admission_date: admissionDate,
        } as never);

        if (!insertErr) {
          results.push({ full_name, admission_number: admissionNumber, admission_date: admissionDate });
          added = true;
        } else if (insertErr.message.includes("students_matric_number_key")) {
          // Collision — try again with a freshly allocated number.
          lastError = insertErr.message;
          continue;
        } else {
          lastError = insertErr.message;
          break;
        }
      }

      if (!added) failures.push({ full_name, reason: lastError ?? "Unknown error" });
    }

    const { data: schoolSettings } = await supabaseAdmin
      .from("college_settings")
      .select("college_name, short_name, address, city, state, motto, logo_url")
      .limit(1)
      .maybeSingle();

    return {
      ok: true as const,
      count: results.length,
      pupils: results,
      failures,
      school: {
        name: schoolSettings?.college_name ?? "the school",
        address: schoolSettings?.address ?? "",
        city: schoolSettings?.city ?? "",
        state: schoolSettings?.state ?? "",
        motto: schoolSettings?.motto ?? "",
      },
    };
  });
