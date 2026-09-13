import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthSession } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { ExamOfficerShell } from "./ExamOfficerShell";
import { Loader2 } from "lucide-react";

export function ProtectedExamOfficer({ children }: { children: ReactNode }) {
  const { session, loading } = useAuthSession();
  const { loading: roleLoading, isExamOfficer, isSuperAdmin } = useRole();
  const navigate = useNavigate();
  const allowed = isExamOfficer || isSuperAdmin;

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!session || !allowed) navigate({ to: "/exam-officer/login" });
  }, [loading, roleLoading, session, allowed, navigate]);

  if (loading || roleLoading || !session || !allowed) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  return <ExamOfficerShell>{children}</ExamOfficerShell>;
}
