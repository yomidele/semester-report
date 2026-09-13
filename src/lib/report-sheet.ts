import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { gradeForScore } from "./grading";
import type { GradeBand } from "./college-settings";

export interface ReportSheetSubjectRow {
  code: string;
  title: string;
  ca: number;
  exam: number;
  total: number;
  classAverage?: number | null;
}

export interface ReportSheetData {
  student: { full_name: string; admission_number: string };
  className: string; // e.g. "Primary 4 — Arm A"
  sessionName: string;
  term: string; // "First" | "Second" | "Third"
  subjects: ReportSheetSubjectRow[];
  position: { rank: number; outOf: number } | null;
  attendance: { present: number; absent: number; total: number } | null;
  comments: { classTeacher?: string | null; headTeacher?: string | null; conduct?: string | null };
  school: { name: string; address?: string; city?: string; state?: string; motto?: string; logo_url?: string | null };
  gradingScale?: GradeBand[];
}

export function generateReportSheetPdf(data: ReportSheetData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 50;

  const addressLine = [data.school.address, data.school.city, data.school.state].filter(Boolean).join(", ");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(data.school.name.toUpperCase(), pageW / 2, y, { align: "center" });
  y += 16;
  if (addressLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(addressLine, pageW / 2, y, { align: "center" });
    y += 12;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("PUPIL'S TERMINAL REPORT SHEET", pageW / 2, y, { align: "center" });
  y += 20;

  doc.setDrawColor(120);
  doc.line(40, y, pageW - 40, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Name: ${data.student.full_name}`, 40, y);
  doc.text(`Admission No: ${data.student.admission_number}`, pageW - 40, y, { align: "right" });
  y += 14;
  doc.text(`Class: ${data.className}`, 40, y);
  doc.text(`Session: ${data.sessionName}`, pageW - 40, y, { align: "right" });
  y += 14;
  doc.text(`Term: ${data.term}`, 40, y);
  if (data.position) doc.text(`Position: ${data.position.rank} of ${data.position.outOf}`, pageW - 40, y, { align: "right" });
  y += 18;

  autoTable(doc, {
    startY: y,
    head: [["Subject", "C.A. (40)", "Exam (60)", "Total (100)", "Grade", "Class Avg"]],
    body: data.subjects.map((s) => {
      const { grade } = gradeForScore(s.total, data.gradingScale);
      return [s.title, s.ca.toFixed(0), s.exam.toFixed(0), s.total.toFixed(0), grade, s.classAverage != null ? s.classAverage.toFixed(1) : "—"];
    }),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [40, 60, 90] },
    margin: { left: 40, right: 40 },
  });

  // @ts-expect-error jspdf-autotable augments doc at runtime
  y = doc.lastAutoTable.finalY + 20;

  const overallAverage = data.subjects.length
    ? data.subjects.reduce((sum, s) => sum + s.total, 0) / data.subjects.length
    : 0;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Term Average: ${overallAverage.toFixed(1)}%`, 40, y);
  y += 20;

  if (data.attendance) {
    doc.setFont("helvetica", "normal");
    doc.text(`Attendance: Present ${data.attendance.present} / ${data.attendance.total} days (Absent ${data.attendance.absent})`, 40, y);
    y += 20;
  }

  if (data.comments.classTeacher) {
    doc.setFont("helvetica", "bold");
    doc.text("Class Teacher's Comment:", 40, y);
    y += 13;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(data.comments.classTeacher, pageW - 80);
    doc.text(lines, 40, y);
    y += lines.length * 12 + 10;
  }
  if (data.comments.headTeacher) {
    doc.setFont("helvetica", "bold");
    doc.text("Head Teacher's Comment:", 40, y);
    y += 13;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(data.comments.headTeacher, pageW - 80);
    doc.text(lines, 40, y);
    y += lines.length * 12 + 10;
  }
  if (data.comments.conduct) {
    doc.setFont("helvetica", "bold");
    doc.text(`Conduct: `, 40, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.comments.conduct, 90, y);
  }

  doc.save(`report_sheet_${data.student.admission_number.replace(/[\/\\]/g, "_")}_${data.term}.pdf`);
}
