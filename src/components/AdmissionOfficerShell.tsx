import { LayoutDashboard, UserPlus, Users, ClipboardCheck, Search } from "lucide-react";
import { PortalShell } from "./PortalShell";

const NAV = [
  { to: "/admission-officer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/applications", label: "Applications", icon: ClipboardCheck },
  { to: "/admission-officer/enroll", label: "Enrol a Pupil", icon: UserPlus },
  { to: "/admission-officer/bulk-add", label: "Bulk Add Pupils", icon: Users },
  { to: "/admission-officer/records", label: "Admission Records", icon: Search },
] as const;

export function AdmissionOfficerShell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell subtitle="Admission Officer Console" loginPath="/admission-officer/login" sections={[{ items: NAV }]}>
      {children}
    </PortalShell>
  );
}
