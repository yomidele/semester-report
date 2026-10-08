import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// The Admission Officer's pupil records — the same pupils and the same data the
// Super Admin sees under Student Records, trimmed to what admissions needs
// (identity, class, admission number/date, guardian, photo). No results.
//
// This reads through the service role on purpose. The admission officer's
// dashboard used to query `students` straight from the browser, so it relied on
// a row-level-security policy for the admission_officer role; if that policy
// wasn't in place on the live database, Postgres returned zero rows with no
// error and the page just looked empty. Going through the server (after
// checking the caller's role) means the officer always sees the same records
// the Super Admin does.

export type AdmissionRecord = {
  id: string;
  full_name: string;
  matric_number: string;
  email: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  status: string;
  admission_date: string;
  passport_url: string | null;
  class_arm_id: string | null;
  class_label: string | null;
};

async function assertAdmissionStaff(userId: string) {
  const { data, error } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const ok = (data ?? []).some((r) => ["admission_officer", "super_admin"].includes(r.role as string));
  if (!ok) throw new Error("Forbidden: requires admission officer or super admin");
}

export const listAdmissionRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdmissionRecord[]> => {
    await assertAdmissionStaff(context.userId);

    const { data: arms, error: armsErr } = await supabaseAdmin
      .from("class_arms")
      .select("id, name, departments:department_id(name)");
    if (armsErr) throw new Error(armsErr.message);
    const armLabel = new Map<string, string>();
    for (const a of (arms ?? []) as any[]) {
      armLabel.set(a.id, `${a.departments?.name ?? ""} ${a.name}`.trim());
    }

    // Page through everything — the API caps a single request at 1000 rows.
    const rows: any[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from("students")
        .select(
          "id, full_name, matric_number, email, gender, date_of_birth, address, guardian_name, guardian_phone, status, admission_date, class_arm_id, passport_url",
        )
        .order("admission_date", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }

    return rows.map((r) => ({
      ...r,
      class_label: r.class_arm_id ? (armLabel.get(r.class_arm_id) ?? null) : null,
    })) as AdmissionRecord[];
  });
