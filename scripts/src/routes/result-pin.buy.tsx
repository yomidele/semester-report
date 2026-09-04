import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, ShieldCheck, ChevronLeft } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyStudentForPin, getPinPurchaseOptions, initializePinPurchase } from "@/lib/result-pin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/result-pin/buy")({
  head: () => ({ meta: [{ title: "Buy Result PIN — Kazaure College" }] }),
  component: BuyPinPage,
});

type VerifiedStudent = Awaited<ReturnType<typeof verifyStudentForPin>>;

function BuyPinPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [matric, setMatric] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [student, setStudent] = useState<VerifiedStudent | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [semester, setSemester] = useState<"First" | "Second" | "">("");
  const [paying, setPaying] = useState(false);

  const verifyStudent = useServerFn(verifyStudentForPin);
  const initPurchase = useServerFn(initializePinPurchase);

  const { data: options, isLoading: optionsLoading } = useQuery({
    queryKey: ["pin-purchase-options"],
    queryFn: () => getPinPurchaseOptions(),
  });

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setVerifying(true);
    try {
      const result = await verifyStudent({ data: { matric_number: matric } });
      setStudent(result);
      setStep(2);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  async function handlePay() {
    if (!sessionId || !semester) {
      toast.error("Select the academic session and semester.");
      return;
    }
    setPaying(true);
    try {
      const callbackUrl = `${window.location.origin}/result-pin/callback`;
      const result = await initPurchase({
        data: { matric_number: matric, session_id: sessionId, semester, callback_url: callbackUrl },
      });
      window.location.href = result.authorization_url;
    } catch (error) {
      toast.error((error as Error).message);
      setPaying(false);
    }
  }

  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">Buy Result PIN</h1>
          <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">
            Purchase a secure PIN to check and download your result online.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 py-12 md:px-6">
        {options && !options.paystack_configured && (
          <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Online payment isn't configured yet on this server (missing <code>PAYSTACK_SECRET_KEY</code> /{" "}
            <code>PAYSTACK_PUBLIC_KEY</code>). Visit the registry to request a PIN in person.
          </div>
        )}

        {step === 1 && (
          <Card className="tsu-shadow">
            <CardHeader>
              <CardTitle className="font-serif text-xl">Step 1 &middot; Enter your details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Student / Matriculation Number</Label>
                  <Input value={matric} onChange={(e) => setMatric(e.target.value)} placeholder="e.g. KCOHT/CH/26/0045" required />
                </div>
                <Button type="submit" disabled={verifying} className="w-full">
                  {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify Student
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 2 && student && (
          <Card className="tsu-shadow">
            <CardHeader>
              <button onClick={() => setStep(1)} className="mb-2 inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline">
                <ChevronLeft className="h-3.5 w-3.5" /> Change student number
              </button>
              <CardTitle className="font-serif text-xl">Step 2 &middot; Confirm &amp; select result period</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-md border border-border bg-secondary/40 p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <CheckCircle2 className="h-4 w-4" /> Student verified
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium text-foreground">{student.full_name}</dd>
                  <dt className="text-muted-foreground">Student ID</dt>
                  <dd className="font-medium text-foreground">{student.matric_number}</dd>
                  <dt className="text-muted-foreground">Programme</dt>
                  <dd className="font-medium text-foreground">{student.programme_name ?? "\u2014"}</dd>
                  <dt className="text-muted-foreground">Department</dt>
                  <dd className="font-medium text-foreground">{student.department_name ?? "\u2014"}</dd>
                  <dt className="text-muted-foreground">School/Faculty</dt>
                  <dd className="font-medium text-foreground">{student.faculty_name ?? "\u2014"}</dd>
                </dl>
              </div>

              {optionsLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
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
                </div>
              )}

              {options && (
                <div className="flex items-center justify-between rounded-md border border-dashed border-border px-4 py-3">
                  <span className="text-sm text-muted-foreground">Result Checking PIN</span>
                  <span className="font-serif text-xl font-bold text-foreground">
                    {"\u20a6"}{options.price.toLocaleString()}
                  </span>
                </div>
              )}

              <Button onClick={handlePay} disabled={paying || !options?.paystack_configured} className="w-full">
                {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Proceed to Payment
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> Payments are processed securely via Paystack.
              </p>
            </CardContent>
          </Card>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have a PIN?{" "}
          <Link to="/check-result" className="font-medium text-primary hover:underline">Check your result</Link>
        </p>
      </div>
    </PublicLayout>
  );
}
