import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEMO_EMAIL = "admin@kazaure.demo";
const DEMO_PASSWORD = "demo1234";

// This used to only create the auth user and stop — it never gave that
// user a row in `user_roles`. `has_role()`/`useRole()` (and therefore
// ProtectedAdmin) check `user_roles`, not the auth user's metadata, so the
// demo admin could authenticate successfully but immediately get bounced
// back to /login since `isSuperAdmin` was always false for them. That's
// what caused "admin dashboard doesn't load after successful login."
// It also only ran the create-user branch once — if the user already
// existed (e.g. created before this fix), it returned early without ever
// checking whether the role row was missing, so the bug would persist
// forever even after re-deploying. Fixed to be fully idempotent: ensure
// the auth user exists, then separately ensure the super_admin role row
// exists, every time this runs, regardless of which part was already done.
export const ensureDemoAdmin = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) {
      console.error("listUsers error:", listErr);
      return { ok: false, error: listErr.message };
    }

    let userId = list.users.find((u) => u.email === DEMO_EMAIL)?.id;
    let created = false;

    if (!userId) {
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { role: "admin", display_name: "Demo Admin" },
      });
      if (createErr || !createData.user) {
        console.error("createUser error:", createErr);
        return { ok: false, error: createErr?.message ?? "Failed to create demo admin user" };
      }
      userId = createData.user.id;
      created = true;
    }

    // Idempotent regardless of whether the user was just created or already
    // existed — this is what actually grants dashboard access.
    const { data: existingRole, error: roleCheckErr } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (roleCheckErr) {
      console.error("user_roles check error:", roleCheckErr);
      return { ok: false, error: roleCheckErr.message };
    }

    if (!existingRole) {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "super_admin" });
      if (roleErr) {
        console.error("user_roles insert error:", roleErr);
        return { ok: false, error: roleErr.message };
      }
    }

    return { ok: true, created };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ensureDemoAdmin failed:", msg);
    return { ok: false, error: msg };
  }
});
