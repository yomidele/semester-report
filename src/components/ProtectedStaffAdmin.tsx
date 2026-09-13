import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthSession } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { AdminShell } from "./AdminShell";
import { Loader2 } from "lucide-react";

// Wider gate than ProtectedAdmin: lets Exam Officers and Admission Officers
// into the same admin console shell as the Super Admin. Each page still does
// its own precise role check (see e.g. students.tsx, examofficer.assignments.tsx)
// — this component only decides who gets past the login wall, matching the
// same pattern ProtectedDeptAdmin already uses for its three allowed roles.
export function ProtectedStaffAdmin({ children }: { children: ReactNode }) {
  const { session, loading } = useAuthSession();
  const { loading: roleLoading, isSuperAdmin, isExamOfficer, isAdmissionOfficer } = useRole();
  const navigate = useNavigate();
  const allowed = isSuperAdmin || isExamOfficer || isAdmissionOfficer;

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!session || !allowed) navigate({ to: "/login" });
  }, [loading, roleLoading, session, allowed, navigate]);

  if (loading || roleLoading || !session || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return <AdminShell>{children}</AdminShell>;
}
