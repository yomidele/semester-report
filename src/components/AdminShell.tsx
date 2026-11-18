import { PortalShell } from "./PortalShell";
import { LayoutDashboard, CalendarDays, BookOpen, Users, ClipboardEdit, FileSpreadsheet, FileText, Building2, Shield, BarChart3, LinkIcon, Settings, GraduationCap, UserRoundCheck, KeyRound, Newspaper, ScrollText, ShieldCheck, LinkIcon as AssignIcon, UserRoundCog, Search, Printer, ClipboardCheck, Languages, TrendingUp } from "lucide-react";
import { useRole } from "@/hooks/use-role";

// Full nav is defined once; each item declares which roles can see it.
// Super Admin sees everything. This is deliberately shell-level filtering
// (what shows in the sidebar) — the actual data access is still enforced by
// each page's own role check and by RLS, so a hidden link is a UX nicety,
// not the security boundary.
const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin", "exam_officer", "admission_officer"] },
  { to: "/sessions", label: "Sessions & Terms", icon: CalendarDays, roles: ["super_admin", "exam_officer"] },
  { to: "/courses", label: "Subjects", icon: BookOpen, roles: ["super_admin"] },
  { to: "/students", label: "Pupils / Admission", icon: Users, roles: ["super_admin", "exam_officer", "admission_officer"] },
  { to: "/result-entry", label: "Result Entry", icon: ClipboardEdit, roles: ["super_admin", "exam_officer"] },
  { to: "/results", label: "View / Export Results", icon: FileSpreadsheet, roles: ["super_admin", "exam_officer"] },
  { to: "/exam-officer/results", label: "Review Results", icon: ClipboardCheck, roles: ["super_admin", "exam_officer"] },
  { to: "/exam-officer/report-sheets", label: "Report Sheets", icon: Printer, roles: ["super_admin", "exam_officer"] },
  { to: "/transcripts", label: "Transcripts", icon: FileText, roles: ["super_admin", "exam_officer"] },
  { to: "/audit-logs", label: "Audit Logs", icon: ScrollText, roles: ["super_admin"] },
  { to: "/validation-audit", label: "Validation Audit", icon: ShieldCheck, roles: ["super_admin"] },
] as const;

const SUPER_ADMIN_NAV = [
  { to: "/admin/records", label: "Student Records", icon: Search, roles: ["super_admin"] },
  { to: "/admin/promotions", label: "Student Promotion", icon: TrendingUp, roles: ["super_admin"] },
  { to: "/admin/settings", label: "Settings", icon: Settings, roles: ["super_admin"] },
  { to: "/exam-officer/classes", label: "Classes & Arms", icon: GraduationCap, roles: ["super_admin"] },
  { to: "/admin/assignments", label: "Teacher Assignments", icon: AssignIcon, roles: ["super_admin"] },
  { to: "/admin/applications", label: "Applications", icon: UserRoundCheck, roles: ["super_admin"] },
  { to: "/admin/result-pins", label: "Result PINs", icon: KeyRound, roles: ["super_admin"] },
  { to: "/admin/news", label: "News", icon: Newspaper, roles: ["super_admin"] },
  { to: "/admin/translations", label: "Hausa Translations", icon: Languages, roles: ["super_admin"] },
  { to: "/admin/staff-profiles", label: "School Administration", icon: Users, roles: ["super_admin"] },
  { to: "/admin/faculties", label: "School Sections", icon: Building2, roles: ["super_admin"] },
  { to: "/admin/teachers", label: "Teachers & Staff Accounts", icon: Shield, roles: ["super_admin"] },
  { to: "/admin/staff-officers", label: "Exam & Admission Officers", icon: Shield, roles: ["super_admin"] },
  { to: "/admin/form-masters", label: "Form Master Assignments", icon: UserRoundCog, roles: ["super_admin"] },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, roles: ["super_admin"] },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, isExamOfficer, isAdmissionOfficer } = useRole();
  const myRoles: string[] = [
    ...(isSuperAdmin ? ["super_admin"] : []),
    ...(isExamOfficer ? ["exam_officer"] : []),
    ...(isAdmissionOfficer ? ["admission_officer"] : []),
  ];
  const visibleNav = NAV.filter((item) => item.roles.some((r) => myRoles.includes(r)));
  const visibleSuperNav = SUPER_ADMIN_NAV.filter((item) => item.roles.some((r) => myRoles.includes(r)));

  return (
    <PortalShell
      subtitle="Admin Console"
      loginPath="/login"
      footer="Model Day Primary School Kazaure — Admin Portal"
      sections={[
        { items: visibleNav },
        { title: isSuperAdmin ? "Super Admin" : "More", items: visibleSuperNav },
      ]}
    >
      {children}
    </PortalShell>
  );
}
