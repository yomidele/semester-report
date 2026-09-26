import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "./use-auth";
export type AppRole = "super_admin" | "teacher" | "exam_officer" | "admission_officer";

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
  const isTeacher = roles.includes("teacher");
  const isSuperAdmin = roles.includes("super_admin");
  const formMasterQuery = useQuery({
    queryKey: ["form-master-assignments", userId],
    enabled: Boolean(userId) && !loading && isTeacher,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lecturers")
        .select("id")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return [];
      const { data: assignments, error: assignmentError } = await supabase
        .from("class_arms")
        .select("id, department_id, name, departments(name)")
        .eq("form_teacher_id", data.id);
      if (assignmentError) throw assignmentError;
      return assignments ?? [];
    },
  });

  return {
    roles,
    loading: loading || (isTeacher && formMasterQuery.isPending),
    isSuperAdmin,
    isTeacher,
    isExamOfficer: roles.includes("exam_officer"),
    isAdmissionOfficer: roles.includes("admission_officer"),
    isFormMaster: (formMasterQuery.data?.length ?? 0) > 0,
    formMasterAssignments: formMasterQuery.data ?? [],
  };
}
