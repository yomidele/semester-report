import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { gradeForScore, ordinal } from "./grading";
import type { GradeBand } from "./college-settings";

/**
 * Terminal REPORT SHEET, laid out exactly like the school's printed sheet
 * (State Universal Basic Education Board, Jigawa State — Model Day Special
 * Primary School Kazaure):
 *
 *   double-line page frame
 *   authority line / school line / (REPORT SHEET)
 *   NAME ---
 *   CLASS --- NO. IN CLASS --- TERM --- 3RD
 *                    POSITION ---
 *   SUBJECTS | C.A | EXAM | TOTAL | GRADE | REMARK      (one row per subject)
 *   TOTAL
 *   AVERAGE SCORES
 *   Form master's Remarks: ---
 *   Head Master Remarks: ---
 *   Next Term Begins: ---
 *                    Head Master stamp & sign.
 */

/** Text printed at the top of the sheet when the school has not overridden it
 *  in college_settings.report_card_settings ({ authority_line, school_line }). */
export const DEFAULT_REPORT_HEADER = {
  authorityLine: "STATE UNIVERSAL BASIC EDUCATION BOARD, JIGAWA STATE",
  schoolLine: "MODEL DAY SPECIAL PRIMARY SCHOOL KAZAURE (L.G.E.A)",
} as const;

export interface ReportSheetSubjectRow {
  code: string;
  title: string;
  /** null = no published score for this subject (row is left blank). */
  ca: number | null;
  exam: number | null;
  total: number | null;
}

export interface ReportSheetData {
  student: { full_name: string; admission_number: string };
  className: string; // e.g. "Primary 4 — Arm A"
  sessionName: string;
  term: string; // "First" | "Second" | "Third"
  subjects: ReportSheetSubjectRow[];
  /** Pupil's position in class (1 = first). Ties share a position. */
  position: number | null;
  /** Number of pupils on the class roll. */
  classSize: number | null;
  comments: { classTeacher?: string | null; headTeacher?: string | null };
  header?: { authorityLine?: string; schoolLine?: string };
  /** ISO date (yyyy-mm-dd) or free text. */
  nextTermBegins?: string | null;
  gradingScale?: GradeBand[];
  /** Optional authenticity block (small, bottom-right) — used by the
   *  parent/PIN result checker so a printed sheet can still be verified,
   *  without changing anything else about the layout. */
  verification?: { number: string; qrDataUrl?: string };
}

export interface GenerateReportSheetOptions {
  /** Draw onto an existing jsPDF document (adds a new page first) instead of
   *  creating one. Used to print several terms as one multi-page PDF while
   *  every page still matches the school's sheet exactly. */
  doc?: jsPDF;
  /** false = return the doc without saving (caller saves once, after the
   *  last term). Defaults to true when `doc` is not supplied. */
  save?: boolean;
  fileName?: string;
}

// Subjects are printed in the same order as the school's paper sheet; any
// subject not recognised here follows alphabetically.
const SUBJECT_ORDER: RegExp[] = [
  /english/i,
  /math/i,
  /basic science|science and tech/i,
  /physical|p\.?h\.?e/i,
  /social|citizen/i,
  /religio|i\.?r\.?s|c\.?r\.?s|islamic|christian/i,
  /hausa|nigerian lang|yoruba|igbo/i,
  /digital|computer|ict/i,
  /cultural|creative|art/i,
  /history/i,
];

export function orderSubjects<T extends { title: string }>(rows: T[]): T[] {
  const rank = (t: string) => {
    const i = SUBJECT_ORDER.findIndex((re) => re.test(t));
    return i === -1 ? SUBJECT_ORDER.length : i;
  };
  return [...rows].sort((a, b) => rank(a.title) - rank(b.title) || a.title.localeCompare(b.title));
}

function termNumber(term: string): number | null {
  const t = term.toLowerCase();
  if (t.startsWith("first") || t === "1") return 1;
  if (t.startsWith("second") || t === "2") return 2;
  if (t.startsWith("third") || t === "3") return 3;
  return null;
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : null;
  if (!d || Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt1 = (n: number | null) => (n === null ? "" : Number.isInteger(n) ? String(n) : n.toFixed(1));

export function generateReportSheetPdf(data: ReportSheetData, opts: GenerateReportSheetOptions = {}): jsPDF {
  const doc = opts.doc ?? new jsPDF({ unit: "pt", format: "a4" });
  if (opts.doc) doc.addPage(); // subsequent term in a multi-term document
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const L = 55; // left content edge
  const R = pageW - 55; // right content edge

  const drawFrame = () => {
    doc.setDrawColor(0);
    doc.setLineDashPattern([], 0);
    doc.setLineWidth(1.4);
    doc.rect(28, 28, pageW - 56, pageH - 56);
    doc.setLineWidth(0.6);
    doc.rect(33, 33, pageW - 66, pageH - 66);
  };

  /** Dashed fill-in line, like the "-----" rules on the paper sheet. */
  const fillLine = (x1: number, x2: number, y: number) => {
    doc.setLineWidth(0.7);
    doc.setLineDashPattern([3, 2], 0);
    doc.line(x1, y + 2, x2, y + 2);
    doc.setLineDashPattern([], 0);
  };

  /** Shrinks text until it fits `maxW`. */
  const fit = (text: string, maxW: number, size: number) => {
    let s = size;
    doc.setFontSize(s);
    while (s > 6 && doc.getTextWidth(text) > maxW) {
      s -= 0.5;
      doc.setFontSize(s);
    }
  };

  drawFrame();

  // ---- Heading ----------------------------------------------------------
  const authority = (data.header?.authorityLine || DEFAULT_REPORT_HEADER.authorityLine).toUpperCase();
  const schoolLine = (data.header?.schoolLine || DEFAULT_REPORT_HEADER.schoolLine).toUpperCase();
  doc.setFont("times", "bold");
  doc.setTextColor(0);
  let y = 78;
  fit(authority, R - L, 13);
  doc.text(authority, pageW / 2, y, { align: "center" });
  y += 26;
  fit(schoolLine, R - L, 13);
  doc.text(schoolLine, pageW / 2, y, { align: "center" });
  y += 28;
  doc.setFontSize(12);
  doc.text("(REPORT SHEET)", pageW / 2, y, { align: "center" });

  // ---- Pupil details ----------------------------------------------------
  y += 34;
  doc.setFontSize(11);
  doc.text("NAME:", L, y);
  fillLine(L + 42, R, y);
  doc.setFont("times", "bold");
  fit(data.student.full_name.toUpperCase(), R - L - 50, 11);
  doc.text(data.student.full_name.toUpperCase(), L + 48, y);

  y += 30;
  doc.setFontSize(11);
  doc.text("CLASS", L, y);
  fillLine(L + 36, 215, y);
  fit(data.className, 215 - (L + 40), 10);
  doc.text(data.className, L + 40, y);

  doc.setFontSize(11);
  doc.text("NO. IN CLASS", 222, y);
  fillLine(222 + 72, 405, y);
  if (data.classSize !== null) {
    doc.setFontSize(11);
    doc.text(String(data.classSize), 222 + 78, y);
  }

  doc.setFontSize(11);
  doc.text("TERM", 412, y);
  fillLine(412 + 34, R, y);
  const tn = termNumber(data.term);
  if (tn !== null) {
    // "3RD" with the ordinal suffix raised, as printed on the paper sheet.
    const suffix = ordinal(tn).replace(String(tn), "").toUpperCase();
    doc.setFontSize(11);
    doc.text(String(tn), 412 + 44, y);
    const w = doc.getTextWidth(String(tn));
    doc.setFontSize(7);
    doc.text(suffix, 412 + 44 + w + 0.5, y - 4);
  } else {
    doc.setFontSize(10);
    doc.text(data.term.toUpperCase(), 412 + 44, y);
  }

  y += 30;
  doc.setFontSize(11);
  doc.text("POSITION", 232, y);
  fillLine(232 + 56, 232 + 56 + 110, y);
  if (data.position !== null) {
    doc.setFontSize(11);
    doc.text(ordinal(data.position), 232 + 62, y);
  }

  // ---- Scores table -----------------------------------------------------
  const scored = data.subjects.filter((s) => s.total !== null && s.ca !== null && s.exam !== null);
  const sumCa = scored.reduce((a, s) => a + (s.ca ?? 0), 0);
  const sumExam = scored.reduce((a, s) => a + (s.exam ?? 0), 0);
  const sumTotal = scored.reduce((a, s) => a + (s.total ?? 0), 0);
  const avgTotal = avg(scored.map((s) => s.total as number));
  const avgInfo = avgTotal === null ? null : gradeForScore(avgTotal, data.gradingScale);

  const body: string[][] = data.subjects.map((s) => {
    if (s.total === null) return [s.title.toUpperCase(), "", "", "", "", ""];
    const info = gradeForScore(s.total, data.gradingScale);
    return [s.title.toUpperCase(), fmt1(s.ca), fmt1(s.exam), fmt1(s.total), info.grade, (info.remark ?? "").toUpperCase()];
  });
  body.push(["TOTAL", scored.length ? fmt1(sumCa) : "", scored.length ? fmt1(sumExam) : "", scored.length ? fmt1(sumTotal) : "", "", ""]);
  body.push([
    "AVERAGE SCORES",
    fmt1(avg(scored.map((s) => s.ca as number)) === null ? null : Math.round((avg(scored.map((s) => s.ca as number)) as number) * 10) / 10),
    fmt1(avg(scored.map((s) => s.exam as number)) === null ? null : Math.round((avg(scored.map((s) => s.exam as number)) as number) * 10) / 10),
    fmt1(avgTotal === null ? null : Math.round(avgTotal * 10) / 10),
    avgInfo?.grade ?? "",
    (avgInfo?.remark ?? "").toUpperCase(),
  ]);

  const subjectRowCount = data.subjects.length;
  autoTable(doc, {
    startY: y + 20,
    head: [["SUBJECTS", "C.A", "EXAM", "TOTAL", "GRADE", "REMARK"]],
    body,
    theme: "grid",
    margin: { left: L - 2, right: pageW - R - 2, top: 50, bottom: 50 },
    tableWidth: R - L + 4,
    styles: {
      font: "times",
      fontSize: 10.5,
      textColor: 0,
      lineColor: 0,
      lineWidth: 0.8,
      fillColor: [255, 255, 255],
      minCellHeight: 25,
      valign: "middle",
      cellPadding: { top: 4, bottom: 4, left: 6, right: 4 },
    },
    headStyles: { fontStyle: "bold", halign: "center", fontSize: 11, textColor: 0, fillColor: [255, 255, 255], lineWidth: 0.8, lineColor: 0 },
    columnStyles: {
      0: { cellWidth: 178, halign: "left" },
      1: { cellWidth: 48, halign: "center" },
      2: { cellWidth: 52, halign: "center" },
      3: { cellWidth: 56, halign: "center" },
      4: { cellWidth: 52, halign: "center" },
      5: { cellWidth: "auto", halign: "center", fontSize: 9 },
    },
    didParseCell: (h) => {
      if (h.section === "body" && h.row.index >= subjectRowCount) h.cell.styles.fontStyle = "bold";
      if (h.section === "head" && h.column.index === 0) h.cell.styles.halign = "center";
    },
    didDrawPage: () => drawFrame(),
  });

  const last = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  y = last + 34;

  // ---- Remarks / next term / stamp -------------------------------------
  if (y + 170 > pageH - 50) {
    doc.addPage();
    drawFrame();
    y = 80;
  }

  const remarkBlock = (label: string, text: string | null | undefined, labelW: number) => {
    doc.setFont("times", "bold");
    doc.setFontSize(11.5);
    doc.text(label, L, y);
    const x1 = L + labelW;
    fillLine(x1, R, y);
    if (text && text.trim()) {
      doc.setFont("times", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(text.trim(), R - x1 - 4) as string[];
      doc.text(lines[0], x1 + 2, y);
      for (let i = 1; i < Math.min(lines.length, 3); i++) {
        y += 16;
        fillLine(L, R, y);
        doc.text(lines[i], L + 2, y);
      }
    }
    y += 32;
  };

  remarkBlock("Form master\u2019s Remarks:", data.comments.classTeacher, 122);
  remarkBlock("Head Master Remarks:", data.comments.headTeacher, 112);
  remarkBlock("Next Term Begins:", formatDate(data.nextTermBegins), 98);

  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("Head Master stamp & sign.", pageW / 2, Math.min(y + 14, pageH - 60), { align: "center" });

  if (data.verification) {
    doc.setFont("times", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(90);
    doc.text(`Verification No: ${data.verification.number}`, R, pageH - 40, { align: "right" });
    doc.text("Scan to verify this document is authentic.", R, pageH - 30, { align: "right" });
    if (data.verification.qrDataUrl) {
      doc.addImage(data.verification.qrDataUrl, "PNG", R - 50, pageH - 96, 50, 50);
    }
    doc.setTextColor(0);
  }

  const shouldSave = opts.save ?? !opts.doc;
  if (shouldSave) {
    doc.save(opts.fileName ?? `report_sheet_${data.student.admission_number.replace(/[\/\\]/g, "_")}_${data.term}.pdf`);
  }
  return doc;
}
