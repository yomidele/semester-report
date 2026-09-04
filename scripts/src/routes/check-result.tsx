import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, FileDown, KeyRound } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCollegeSettings } from "@/lib/college-settings";
import { effectiveTotal, computeGrade } from "@/lib/grading";
import { checkResult, getPinPurchaseOptions } from "@/lib/result-pin.functions";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

export const Route = createFileRoute("/check-result")({
  head: () => ({
    meta: [
      { title: "Check Result — Kazaure College" },
      { name: "description", content: "Enter your matriculation number and Result PIN to view and download your official result." },
    ],
  }),
  component: CheckResultPage,
});

type ResultData = Awaited<ReturnType<typeof checkResult>>;

function CheckResultPage() {
  const { settings } = useCollegeSettings();
  const check = useServerFn(checkResult);
  const [matric, setMatric] = useState("");
  const [pin, setPin] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [semester, setSemester] = useState<"First" | "Second" | "">("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: options } = useQuery({ queryKey: ["pin-purchase-options"], queryFn: () => getPinPurchaseOptions() });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!sessionId || !semester) {
      toast.error("Select the academic session and semester.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await check({ data: { matric_number: matric, pin, session_id: sessionId, semester } });
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function downloadReportCard() {
    if (!result) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;

    doc.setFillColor(5, 87, 56);
    doc.rect(0, 0, pageWidth, 90, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(settings.college_name.toUpperCase(), margin, 38);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text([settings.address, settings.city, settings.state].filter(Boolean).join(", "), margin, 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("OFFICIAL STUDENT RESULT REPORT CARD", margin, 76);

    doc.setTextColor(20, 20, 20);
    let y = 115;
    const line = (label: string, value: string, x: number) => {
      doc.setFont("helvetica", "bold").setFontSize(8);
      doc.text(label.toUpperCase(), x, y);
      doc.setFont("helvetica", "normal").setFontSize(11);
      doc.text(value || "\u2014", x, y + 14);
    };
    const col2 = pageWidth / 2 + 10;
    line("Student Name", result.student.full_name, margin);
    line("Matric Number", result.student.matric_number, col2);
    y += 32;
    line("Programme", result.student.programme_name ?? "\u2014", margin);
    line("Department", result.student.department_name ?? "\u2014", col2);
    y += 32;
    line("School/Faculty", result.student.faculty_name ?? "\u2014", margin);
    line("Session / Semester", `${result.session_name} \u2014 ${result.semester} Semester`, col2);
    y += 40;

    const rows = result.results.map((r) => {
      const total = effectiveTotal(r);
      const { grade, remark } = computeGrade(total, settings.grading_scale);
      return [r.course_code, r.course_title, String(r.unit), String(r.ca_score), String(r.exam_score), String(total), grade, remark ?? ""];
    });

    autoTable(doc, {
      startY: y,
      head: [["Code", "Course Title", "Unit", "CA", "Exam", "Total", "Grade", "Remark"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [5, 87, 56], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 5 },
      margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let finalY = (doc as any).lastAutoTable?.finalY ?? y + 40;
    finalY += 30;

    const totalUnits = result.results.reduce((s, r) => s + r.unit, 0);
    const totalPoints = result.results.reduce((s, r) => s + computeGrade(effectiveTotal(r), settings.grading_scale).point * r.unit, 0);
    const gpa = totalUnits ? (totalPoints / totalUnits).toFixed(2) : "0.00";

    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.text(`Semester GPA: ${gpa}`, margin, finalY);
    doc.text(`Total Units: ${totalUnits}`, margin + 180, finalY);
    finalY += 30;

    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text("Authorized Signature: ________________________", margin, finalY + 40);
    doc.text("School Stamp:", margin + 280, finalY + 40);
    doc.rect(margin + 340, finalY + 15, 100, 40);

    doc.setFontSize(8).setTextColor(100, 100, 100);
    doc.text(`Verification No: ${result.verification_number}`, margin, finalY + 70);
    doc.text("Scan the QR code to verify this document is authentic.", margin, finalY + 82);

    try {
      const verifyUrl = `${window.location.origin}/verify-result/${result.verification_number}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 200 });
      doc.addImage(qrDataUrl, "PNG", pageWidth - margin - 70, finalY + 5, 70, 70);
    } catch {
      // QR generation failing is non-fatal — the printed verification number still works.
    }

    doc.save(`${result.student.matric_number}-${result.session_name}-${result.semester}-result.pdf`);
  }

  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">Check Your Result</h1>
          <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">
            Enter your details and Result PIN below to view your published result.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-12 md:px-6">
        <Card className="tsu-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <KeyRound className="h-5 w-5 text-primary" /> Check Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Student / Matr No.</Label>
                <Input value={matric} onChange={(e) => setMatric(e.target.value)} required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Result PIN</Label>
                <Input value={pin} onChange={(e) => setPin(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" required />
              </div>
              <label className="space-y-1.5 text-sm font-medium">
                <Label>Academic Session</Label>
                <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select session</option>
                  {options?.sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                <Label>Semester</Label>
                <select value={semester} onChange={(e) => setSemester(e.target.value as "First" | "Second")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select semester</option>
                  <option value="First">First Semester</option>
                  <option value="Second">Second Semester</option>
                </select>
              </label>

              {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}

              <Button type="submit" disabled={loading} className="sm:col-span-2">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Check Result
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Don't have a PIN?{" "}
              <Link to="/result-pin/buy" className="font-medium text-primary hover:underline">Buy Result PIN</Link>
            </p>
          </CardContent>
        </Card>

        {result && (
          <Card className="tsu-shadow mt-8">
            <CardContent className="space-y-6 p-6">
              <div>
                <h2 className="font-serif text-xl font-bold text-foreground">{result.student.full_name}</h2>
                <p className="text-sm text-muted-foreground">
                  {result.student.matric_number} &middot; {result.student.programme_name} &middot; {result.session_name} &middot; {result.semester} Semester
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-3">Code</th>
                      <th className="py-2 pr-3">Course Title</th>
                      <th className="py-2 pr-3">Unit</th>
                      <th className="py-2 pr-3">CA</th>
                      <th className="py-2 pr-3">Exam</th>
                      <th className="py-2 pr-3">Total</th>
                      <th className="py-2 pr-3">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r) => {
                      const total = effectiveTotal(r);
                      const { grade } = computeGrade(total, settings.grading_scale);
                      return (
                        <tr key={r.course_code} className="border-b border-border/60">
                          <td className="py-2 pr-3 font-medium">{r.course_code}</td>
                          <td className="py-2 pr-3">{r.course_title}</td>
                          <td className="py-2 pr-3">{r.unit}</td>
                          <td className="py-2 pr-3">{r.ca_score}</td>
                          <td className="py-2 pr-3">{r.exam_score}</td>
                          <td className="py-2 pr-3 font-semibold">{total}</td>
                          <td className="py-2 pr-3">{grade}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                PIN usage: {result.pin_usage.views_used}/{result.pin_usage.max_views} views &middot; Verification No. {result.verification_number}
              </p>
              <Button onClick={downloadReportCard}>
                <FileDown className="mr-2 h-4 w-4" /> Download Official Report Card
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </PublicLayout>
  );
}
