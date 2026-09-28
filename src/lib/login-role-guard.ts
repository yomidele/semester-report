import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/use-role";

// Every role-specific login page (Super Admin, Teacher, Exam Officer,
// Admission Officer) used to just call supabase.auth.signInWithPassword and
// show "Signed in" the moment the password checked out — password
// correctness is all that call verifies, it has no idea which portal you're
// signing into. A Teacher typing their real, correct password into the
// Super Admin page authenticated successfully, saw "Signed in," and then
// nothing happened: the page's own redirect effect waits for the role
// check to confirm super_admin, which a teacher will never have, so it just
// sat there forever with no error and no dashboard. Looked exactly like a
// stuck/broken login.
//
// This checks the signed-in user's actual role in `user_roles` right after
// auth succeeds, and if it doesn't match the portal they're on, signs them
// back out immediately (so a mismatched session never lingers) and returns
// a clear, specific error instead of a silent hang.
export async function signInForRole(
  email: string,
  password: string,
  requiredRole: AppRole | AppRole[],
  roleLabel: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  const userId = data.user?.id;
  if (!userId) return { ok: false, error: "Sign-in failed — please try again." };

  const { data: roleRows, error: roleErr } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (roleErr) {
    await supabase.auth.signOut();
    return { ok: false, error: "Could not verify your account role. Please try again." };
  }

  const required = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const hasRole = (roleRows ?? []).some((r) => required.includes(r.role as AppRole));
  if (!hasRole) {
    await supabase.auth.signOut();
    return { ok: false, error: `These login details are not registered for the ${roleLabel} portal.` };
  }

  return { ok: true };
}
