import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "./use-auth";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"] extends { app_role: infer R } ? R : "super_admin" | "faculty_admin" | "student";

export function useRole() {
  const { session, loading: sessionLoading } = useAuthSession();
  // Was keyed off the whole `session` object before — Supabase silently
  // refreshes the access token on a timer, which produces a brand-new
  // session object for the SAME user. That made this effect re-run and
  // re-query user_roles on every token refresh, and any transient hiccup in
  // that refetch (network blip, RLS evaluated a beat before the refreshed
  // token settled) would briefly overwrite good roles with an empty array —
  // which is what caused admin dashboards to flicker between content and
  // the loading spinner. Keying off the user id instead means this only
  // re-runs when who's logged in actually changes, not on every silent
  // token refresh.
  const userId = session?.user?.id ?? null;

  const query = useQuery({
    queryKey: ["user-roles", userId],
    enabled: Boolean(userId) && !sessionLoading,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      if (!userId) return [] as AppRole[];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

  // Successful role data stays available while React Query refreshes it.
  const roles = query.data ?? [];
  const loading = sessionLoading || (Boolean(userId) && query.isPending);

  return {
    roles,
    loading,
    isSuperAdmin: roles.includes("super_admin" as AppRole),
    isFacultyAdmin: roles.includes("faculty_admin" as AppRole),
    isStudent: roles.includes("student" as AppRole),
  };
}
