import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthSession } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { AdmissionOfficerShell } from "./AdmissionOfficerShell";
import { Loader2 } from "lucide-react";

export function ProtectedAdmissionOfficer({ children }: { children: ReactNode }) {
  const { session, loading } = useAuthSession();
  const { loading: roleLoading, isAdmissionOfficer, isSuperAdmin } = useRole();
  const navigate = useNavigate();
  const allowed = isAdmissionOfficer || isSuperAdmin;

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!session || !allowed) navigate({ to: "/admission-officer/login" });
  }, [loading, roleLoading, session, allowed, navigate]);

  if (loading || roleLoading || !session || !allowed) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  return <AdmissionOfficerShell>{children}</AdmissionOfficerShell>;
}
