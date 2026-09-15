import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { TSUHeader } from "./TSUHeader";
import { LayoutDashboard, CalendarDays, BookOpen, Users, ClipboardEdit, FileSpreadsheet, FileText, LogOut, Building2, Shield, BarChart3, LinkIcon, Settings, GraduationCap, UserRoundCheck, KeyRound, Newspaper, ScrollText, ShieldCheck, LinkIcon as AssignIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";

// Full nav is defined once; each item declares which roles can see it.
// Super Admin sees everything. This is deliberately shell-level filtering
// (what shows in the sidebar) — the actual data access is still enforced by
// each page's own role check and by RLS, so a hidden link is a UX nicety,
// not the security boundary.
const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin", "exam_officer", "admission_officer"] },
  { to: "/sessions", label: "Sessions & Terms", icon: CalendarDays, roles: ["super_admin"] },
  { to: "/courses", label: "Subjects", icon: BookOpen, roles: ["super_admin", "exam_officer"] },
  { to: "/students", label: "Pupils / Admission", icon: Users, roles: ["super_admin", "exam_officer", "admission_officer"] },
  { to: "/result-entry", label: "Result Entry", icon: ClipboardEdit, roles: ["super_admin", "exam_officer"] },
  { to: "/results", label: "View / Export Results", icon: FileSpreadsheet, roles: ["super_admin", "exam_officer"] },
  { to: "/transcripts", label: "Report Sheets", icon: FileText, roles: ["super_admin", "exam_officer"] },
  { to: "/audit-logs", label: "Audit Logs", icon: ScrollText, roles: ["super_admin"] },
  { to: "/validation-audit", label: "Validation Audit", icon: ShieldCheck, roles: ["super_admin"] },
] as const;

const SUPER_ADMIN_NAV = [
  { to: "/admin/settings", label: "Settings", icon: Settings, roles: ["super_admin"] },
  { to: "/exam-officer/classes", label: "Classes & Arms", icon: GraduationCap, roles: ["super_admin", "exam_officer"] },
  { to: "/exam-officer/assignments", label: "Teacher Assignments", icon: AssignIcon, roles: ["super_admin", "exam_officer"] },
  { to: "/admin/applications", label: "Applications", icon: UserRoundCheck, roles: ["super_admin"] },
  { to: "/admin/result-pins", label: "Result PINs", icon: KeyRound, roles: ["super_admin"] },
  { to: "/admin/news", label: "News", icon: Newspaper, roles: ["super_admin"] },
  { to: "/admin/staff-profiles", label: "School Administration", icon: Users, roles: ["super_admin"] },
  { to: "/admin/faculties", label: "School Sections", icon: Building2, roles: ["super_admin"] },
  { to: "/admin/faculty-admins", label: "Staff Accounts", icon: Shield, roles: ["super_admin"] },
  { to: "/admin/staff-officers", label: "Exam & Admission Officers", icon: Shield, roles: ["super_admin"] },
  { to: "/admin/registration-links", label: "Registration Links", icon: LinkIcon, roles: ["super_admin"] },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, roles: ["super_admin"] },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSuperAdmin, isExamOfficer, isAdmissionOfficer } = useRole();
  const myRoles = [
    ...(isSuperAdmin ? ["super_admin"] : []),
    ...(isExamOfficer ? ["exam_officer"] : []),
    ...(isAdmissionOfficer ? ["admission_officer"] : []),
  ];
  const visibleNav = NAV.filter((item) => item.roles.some((r) => myRoles.includes(r)));
  const visibleSuperNav = SUPER_ADMIN_NAV.filter((item) => item.roles.some((r) => myRoles.includes(r)));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TSUHeader subtitle="Admin Console — Demo Environment" />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-2 py-4 md:flex-row md:px-6">
        <aside className="md:w-60 md:shrink-0">
          <nav className="tsu-shadow flex flex-row gap-1 overflow-x-auto rounded-md border border-border bg-card p-2 md:flex-col md:overflow-visible">
            {visibleNav.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{label}</span>
                </Link>
              );
            })}
            {visibleSuperNav.length > 0 && (
              <>
                <div className="hidden md:block md:px-2 md:pt-3 md:pb-1 md:text-[10px] md:font-semibold md:uppercase md:tracking-wider md:text-muted-foreground">
                  {isSuperAdmin ? "Super Admin" : "More"}
                </div>
                {visibleSuperNav.map(({ to, label, icon: Icon }) => {
                  const active = location.pathname === to;
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="whitespace-nowrap">{label}</span>
                    </Link>
                  );
                })}
              </>
            )}
            <div className="md:mt-auto md:pt-2">
              <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </div>
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">
         © {new Date().getFullYear()} Model Day Primary School Kazaure — Admin Portal
      </footer>
    </div>
  );
}
