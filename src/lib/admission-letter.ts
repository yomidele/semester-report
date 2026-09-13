import jsPDF from "jspdf";

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
};

export function generateAdmissionLetterPdf(data: AdmissionLetterData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 56;

  const schoolAddressLine = [data.school.address, data.school.city, data.school.state].filter(Boolean).join(", ");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(data.school.name.toUpperCase(), pageW / 2, y, { align: "center" });
  y += 18;

  if (schoolAddressLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(schoolAddressLine, pageW / 2, y, { align: "center" });
    y += 14;
  }
  if (data.school.motto) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`"${data.school.motto}"`, pageW / 2, y, { align: "center" });
    y += 14;
  }

  doc.setDrawColor(40);
  doc.line(56, y, pageW - 56, y);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(new Date(data.admission_date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }), pageW - 56, y, { align: "right" });
  y += 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("LETTER OF ADMISSION", pageW / 2, y, { align: "center" });
  y += 30;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const bodyLines = doc.splitTextToSize(
    `Dear Parent/Guardian,\n\n` +
      `We are pleased to inform you that ${data.full_name} has been offered admission into ${data.class_name} of ${data.school.name} for the current academic session.\n\n` +
      `The pupil's admission number is ${data.admission_number}. Kindly quote this number in all future correspondence with the school, and ensure the pupil resumes on the official first day of term with the required uniform and materials.\n\n` +
      `We look forward to a fruitful partnership with you in the pupil's education.`,
    pageW - 112,
  );
  doc.text(bodyLines, 56, y);
  y += bodyLines.length * 15 + 40;

  doc.setFont("helvetica", "bold");
  doc.text("_____________________________", 56, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.text("Head Teacher / Admission Officer", 56, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Admission No: ${data.admission_number}`, pageW - 56, 56 + (schoolAddressLine ? 14 : 0) + (data.school.motto ? 14 : 0), { align: "right" });

  doc.save(`admission_letter_${data.admission_number.replace(/[\/\\]/g, "_")}.pdf`);
}
