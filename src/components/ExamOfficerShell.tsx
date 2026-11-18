import { LayoutDashboard, CalendarDays, ClipboardCheck, FileText } from "lucide-react";
import { PortalShell } from "./PortalShell";

const NAV = [
  { to: "/exam-officer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sessions", label: "Sessions & Terms", icon: CalendarDays },
  { to: "/exam-officer/results", label: "Review Results", icon: ClipboardCheck },
  { to: "/exam-officer/report-sheets", label: "Report Sheets", icon: ClipboardCheck },
  { to: "/transcripts", label: "Transcripts", icon: FileText },
] as const;

export function ExamOfficerShell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell subtitle="Exam Officer Console" loginPath="/exam-officer/login" sections={[{ items: NAV }]}>
      {children}
    </PortalShell>
  );
}
