import { LayoutDashboard, ClipboardEdit, CalendarCheck } from "lucide-react";
import { PortalShell } from "./PortalShell";

const NAV = [
  { to: "/lecturer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/lecturer/entry", label: "Grade Entry", icon: ClipboardEdit },
  { to: "/lecturer/attendance", label: "Attendance", icon: CalendarCheck },
] as const;

export function TeacherShell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell subtitle="Teacher Console" loginPath="/lecturer/login" sections={[{ items: NAV }]}>
      {children}
    </PortalShell>
  );
}
