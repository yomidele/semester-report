import jsPDF from "jspdf";
import { drawFrame, drawLetterheadHeader } from "./report-sheet";

export type AdmissionLetterData = {
  admission_number: string;
  full_name: string;
  admission_date: string; // ISO
  class_name: string; // e.g. "Primary 4 — Arm A"
  school: {
    name: string;
    short_name?: string;
    address?: string;
    city?: string;
    state?: string;
    motto?: string;
  };
  /** Same override shape as ReportSheetData.header — when omitted, this
   *  falls back to DEFAULT_REPORT_HEADER, exactly like the Report Sheet
   *  does, so the two documents' letterheads never drift apart. */
  header?: { authorityLine?: string; schoolLine?: string };
};

// Same physical letterhead as the Report Sheet (src/lib/report-sheet.ts):
// the double-line frame, authority line, and school line are drawn by the
// exact same shared functions, just with this document's own title line.
function drawAdmissionLetter(doc: jsPDF, data: AdmissionLetterData) {
  const pageW = doc.internal.pageSize.getWidth();
  const L = 55;
  const R = pageW - 55;

  drawFrame(doc);
  let y = drawLetterheadHeader(doc, "(LETTER OF ADMISSION)", data.header);

  y += 40;
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text(new Date(data.admission_date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }), R, y, { align: "right" });
  y += 30;

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  const bodyLines = doc.splitTextToSize(
    `Dear Parent/Guardian,\n\n` +
      `We are pleased to inform you that ${data.full_name} has been offered admission into ${data.class_name} of ${data.school.name} for the current academic session.\n\n` +
      `The pupil's admission number is ${data.admission_number}. Kindly quote this number in all future correspondence with the school, and ensure the pupil resumes on the official first day of term with the required uniform and materials.\n\n` +
      `We look forward to a fruitful partnership with you in the pupil's education.`,
    R - L,
  );
  doc.text(bodyLines, L, y);
  y += bodyLines.length * 15 + 40;

  doc.setFont("times", "bold");
  doc.text("_____________________________", L, y);
  y += 16;
  doc.setFont("times", "normal");
  doc.text("Head Teacher / Admission Officer", L, y);

  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text(`Admission No: ${data.admission_number}`, R, 78, { align: "right" });
}

export function generateAdmissionLetterPdf(data: AdmissionLetterData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  drawAdmissionLetter(doc, data);
  doc.save(`admission_letter_${data.admission_number.replace(/[\/\\]/g, "_")}.pdf`);
}

/** One combined PDF, one admission letter per page — for a bulk-added class list. */
export function generateBulkAdmissionLettersPdf(entries: AdmissionLetterData[], fileLabel: string) {
  if (entries.length === 0) return;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  entries.forEach((entry, i) => {
    if (i > 0) doc.addPage();
    drawAdmissionLetter(doc, entry);
  });
  doc.save(`admission_letters_${fileLabel.replace(/[^a-z0-9]+/gi, "_")}.pdf`);
}
