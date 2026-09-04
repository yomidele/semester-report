// Server-only. Generates the official Result PIN Voucher PDF with pdf-lib
// (works in a plain Node/edge server function — no browser/canvas needed).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CollegeSettings } from "./college-settings";

export interface VoucherData {
  voucherNumber: string;
  pin: string; // raw PIN — only ever passed in-memory, right after generation
  studentName: string;
  matricOrApplicantRef: string;
  programmeName: string;
  departmentName: string;
  sessionName: string;
  semester: string;
  maxViews: number;
  expiresAt: Date;
  paymentReference: string;
  purchaseDate: Date;
  college: CollegeSettings;
}

const GREEN = rgb(0.02, 0.34, 0.22);
const GOLD = rgb(0.7, 0.55, 0.1);
const INK = rgb(0.13, 0.13, 0.13);
const MUTED = rgb(0.42, 0.42, 0.42);
const LINE = rgb(0.85, 0.85, 0.85);

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export async function generateVoucherPdf(data: VoucherData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  const margin = 48;
  const width = page.getWidth();
  let y = page.getHeight() - margin;

  // Header band
  page.drawRectangle({ x: 0, y: page.getHeight() - 150, width, height: 150, color: GREEN });
  page.drawRectangle({ x: 0, y: page.getHeight() - 154, width, height: 4, color: GOLD });

  page.drawText(data.college.college_name.toUpperCase(), {
    x: margin, y: page.getHeight() - 60, size: 17, font: bold, color: rgb(1, 1, 1), maxWidth: width - margin * 2,
  });
  const addressLine = [data.college.address, data.college.city, data.college.state].filter(Boolean).join(", ");
  if (addressLine) {
    page.drawText(addressLine, { x: margin, y: page.getHeight() - 80, size: 9, font: regular, color: rgb(0.9, 0.93, 0.9) });
  }
  const contactLine = [data.college.phone, data.college.email].filter(Boolean).join("   \u2022   ");
  if (contactLine) {
    page.drawText(contactLine, { x: margin, y: page.getHeight() - 94, size: 9, font: regular, color: rgb(0.9, 0.93, 0.9) });
  }
  page.drawText("RESULT CHECKING PIN VOUCHER", {
    x: margin, y: page.getHeight() - 130, size: 13, font: bold, color: GOLD,
  });

  y = page.getHeight() - 180;

  const field = (label: string, value: string, colX: number, colWidth: number) => {
    page.drawText(label.toUpperCase(), { x: colX, y, size: 8, font: bold, color: MUTED });
    page.drawText(value || "\u2014", { x: colX, y: y - 15, size: 11.5, font: regular, color: INK, maxWidth: colWidth });
  };

  const colGap = 20;
  const colWidth = (width - margin * 2 - colGap) / 2;
  const rowHeight = 42;

  const rows: Array<[string, string, string, string]> = [
    ["Student Name", data.studentName, "Matriculation / Applicant No.", data.matricOrApplicantRef],
    ["Programme", data.programmeName, "Department", data.departmentName],
    ["Academic Session", data.sessionName, "Semester", `${data.semester} Semester`],
  ];
  for (const [l1, v1, l2, v2] of rows) {
    field(l1, v1, margin, colWidth);
    field(l2, v2, margin + colWidth + colGap, colWidth);
    y -= rowHeight;
  }

  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: LINE });
  y -= 36;

  // PIN block
  const pinBoxHeight = 76;
  page.drawRectangle({
    x: margin, y: y - pinBoxHeight + 20, width: width - margin * 2, height: pinBoxHeight,
    color: rgb(0.96, 0.98, 0.96), borderColor: GREEN, borderWidth: 1.2,
  });
  page.drawText("RESULT PIN", {
    x: margin, y: y + 20, size: 9, font: bold, color: MUTED,
  });
  const pinSize = 26;
  const pinWidth = bold.widthOfTextAtSize(data.pin, pinSize);
  page.drawText(data.pin, {
    x: (width - pinWidth) / 2, y: y - 8, size: pinSize, font: bold, color: GREEN,
  });
  y -= pinBoxHeight + 10;

  // Meta row
  const metaRows: Array<[string, string, string, string]> = [
    ["Maximum Views", String(data.maxViews), "Valid Until", fmtDate(data.expiresAt)],
    ["Payment Reference", data.paymentReference, "Voucher Number", data.voucherNumber],
    ["Purchase Date", fmtDate(data.purchaseDate), "", ""],
  ];
  for (const [l1, v1, l2, v2] of metaRows) {
    field(l1, v1, margin, colWidth);
    if (l2) field(l2, v2, margin + colWidth + colGap, colWidth);
    y -= rowHeight;
  }

  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: LINE });
  y -= 24;

  const instructions = [
    "Keep this voucher safe. This PIN is assigned specifically to the student named above and cannot be",
    "used by any other student. Visit the college website and choose \u201cCheck Result\u201d, then enter the",
    "matriculation number and PIN exactly as shown to view and download the official result.",
  ];
  for (const line of instructions) {
    page.drawText(line, { x: margin, y, size: 9, font: regular, color: MUTED });
    y -= 13;
  }

  // Footer
  page.drawLine({ start: { x: margin, y: 60 }, end: { x: width - margin, y: 60 }, thickness: 0.75, color: LINE });
  page.drawText(`${data.college.college_name} \u2014 Official Result PIN Voucher \u2014 Not valid if altered.`, {
    x: margin, y: 44, size: 7.5, font: regular, color: MUTED,
  });

  return doc.save();
}
