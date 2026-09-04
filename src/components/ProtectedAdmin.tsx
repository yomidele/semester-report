import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthSession } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { AdminShell } from "./AdminShell";
import { Loader2 } from "lucide-react";

// NOTE: this previously only checked that a session existed — not that the
// session belonged to an admin. That meant any authenticated user (a
// student, a lecturer, anyone) could open /students, /results, /audit-logs,
// etc. directly by URL. Fixed to match the same role-check pattern already
// used correctly in ProtectedStudent/ProtectedFaculty/ProtectedLecturer/
// ProtectedDeptAdmin.
export function ProtectedAdmin({ children }: { children: ReactNode }) {
  const { session, loading } = useAuthSession();
  const { loading: roleLoading, isSuperAdmin } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!session || !isSuperAdmin) navigate({ to: "/login" });
  }, [loading, roleLoading, session, isSuperAdmin, navigate]);

  if (loading || roleLoading || !session || !isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return <AdminShell>{children}</AdminShell>;
}
