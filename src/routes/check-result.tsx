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
import { generateReportSheetPdf } from "@/lib/report-sheet";
import { checkResult, getPinPurchaseOptions } from "@/lib/result-pin.functions";
import { toast } from "sonner";
import QRCode from "qrcode";

export const Route = createFileRoute("/check-result")({
  head: () => ({
    meta: [
      { title: "Check Result — School Portal" },
      { name: "description", content: "Enter your matriculation number and Result PIN to view and download your official result." },
    ],
  }),
  component: CheckResultPage,
});

type ResultData = Awaited<ReturnType<typeof checkResult>>;

function CheckResultPage() {
  const { settings } = useCollegeSettings();
  const check = useServerFn(checkResult);
  const [matric, setAdmissionNumber] = useState("");
  const [pin, setPin] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [semester, setTerm] = useState<"First" | "Second" | "Third" | "">("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: options } = useQuery({ queryKey: ["pin-purchase-options"], queryFn: () => getPinPurchaseOptions() });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!sessionId || !semester) {
      toast.error("Select the academic session and term.");
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

    let qrDataUrl: string | undefined;
    try {
      const verifyUrl = `${window.location.origin}/verify-result/${result.verification_number}`;
      qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 200 });
    } catch {
      // QR generation failing is non-fatal — the printed verification number still works.
    }

    // Same physical sheet every other export uses — a pupil's result must
    // look identical whether the Exam Officer, an admin, or a parent (here,
    // via Result PIN) downloads it. Only the verification block is added,
    // since a parent needs a way to prove a printed copy is genuine.
    generateReportSheetPdf(
      {
        student: { full_name: result.student.full_name, admission_number: result.student.matric_number },
        className: result.student.department_name ?? "\u2014",
        sessionName: result.session_name,
        term: result.semester,
        subjects: result.results.map((r) => ({
          code: r.course_code,
          title: r.course_title,
          ca: r.ca_score,
          exam: r.exam_score,
          total: effectiveTotal(r),
        })),
        position: null,
        classSize: null,
        comments: {},
        gradingScale: settings.grading_scale,
        verification: { number: result.verification_number, qrDataUrl },
      },
      { fileName: `${result.student.matric_number}-${result.session_name}-${result.semester}-result.pdf` },
    );
  }

  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">Check Your Result</h1>
          <p className="mt-2 max-w-2xl text-sm text-sidebar-foreground/80">
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
                <Label>Pupil / Admission No.</Label>
                <Input value={matric} onChange={(e) => setAdmissionNumber(e.target.value)} required />
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
                <Label>Term</Label>
                <select value={semester} onChange={(e) => setTerm(e.target.value as "First" | "Second" | "Third")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select term</option>
                  <option value="First">First Term</option>
                  <option value="Second">Second Term</option>
                  <option value="Third">Third Term</option>
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
                  {result.student.matric_number} &middot; {result.student.department_name ?? "\u2014"} &middot; {result.session_name} &middot; {result.semester} Term
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-3">Code</th>
                      <th className="py-2 pr-3">Subject Title</th>
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
