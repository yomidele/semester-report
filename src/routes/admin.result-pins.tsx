import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, KeyRound, Ban } from "lucide-react";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import {
  adminGetPinStats,
  adminListResultPins,
  adminListPinPayments,
  adminGenerateManualPin,
  adminDisablePin,
  getPinPurchaseOptions,
} from "@/lib/result-pin.functions";

export const Route = createFileRoute("/admin/result-pins")({
  head: () => ({ meta: [{ title: "Result PIN Management — Super Admin" }] }),
  component: () => (
    <ProtectedAdmin>
      <Page />
    </ProtectedAdmin>
  ),
});

function Page() {
  const { isSuperAdmin, loading } = useRole();
  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin text-primary" />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;
  return <ResultPinManagement />;
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  exhausted: "bg-amber-100 text-amber-800",
  expired: "bg-muted text-muted-foreground",
  disabled: "bg-destructive/10 text-destructive",
  successful: "bg-primary/10 text-primary",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-destructive/10 text-destructive",
  reversed: "bg-destructive/10 text-destructive",
};

function ResultPinManagement() {
  const queryClient = useQueryClient();
  const stats = useQuery({ queryKey: ["admin-pin-stats"], queryFn: () => adminGetPinStats() });
  const pins = useQuery({ queryKey: ["admin-pin-list"], queryFn: () => adminListResultPins() });
  const payments = useQuery({ queryKey: ["admin-pin-payments"], queryFn: () => adminListPinPayments() });
  const options = useQuery({ queryKey: ["pin-purchase-options"], queryFn: () => getPinPurchaseOptions() });

  const disablePin = useServerFn(adminDisablePin);
  const disableMutation = useMutation({
    mutationFn: (input: { pin_id: string; reason: string }) => disablePin({ data: input }),
    onSuccess: () => {
      toast.success("PIN disabled");
      queryClient.invalidateQueries({ queryKey: ["admin-pin-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pin-stats"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function handleDisable(pinId: string) {
    const reason = window.prompt("Reason for disabling this PIN (e.g. payment reversed)?");
    if (!reason) return;
    disableMutation.mutate({ pin_id: pinId, reason });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 font-serif text-2xl font-bold">
          <KeyRound className="h-5 w-5 text-primary" /> Result PIN Management
        </h2>
        <p className="text-sm text-muted-foreground">
          Sales, active PINs and manual issuance for the result checking system.
        </p>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      {stats.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : stats.data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <StatCard label="Total PINs" value={stats.data.total} />
          <StatCard label="Online" value={stats.data.online} />
          <StatCard label="Manual" value={stats.data.manual} />
          <StatCard label="Active" value={stats.data.active} />
          <StatCard label="Exhausted" value={stats.data.exhausted} />
          <StatCard label="Expired" value={stats.data.expired} />
          <StatCard label="Disabled" value={stats.data.disabled} />
          <StatCard
            label="Revenue"
            value={`₦${stats.data.totalRevenue.toLocaleString()}`}
          />
        </div>
      ) : null}

      {/* ── Manual issuance ──────────────────────────────────────────── */}
      <ManualIssuanceCard
        sessions={options.data?.sessions ?? []}
        onIssued={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-pin-list"] });
          queryClient.invalidateQueries({ queryKey: ["admin-pin-stats"] });
        }}
      />

      {/* ── PIN listing ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issued PINs</CardTitle>
        </CardHeader>
        <CardContent>
          {pins.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Session</th>
                    <th className="py-2 pr-3">Semester</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Views</th>
                    <th className="py-2 pr-3">PIN ends</th>
                    <th className="py-2 pr-3">Issued</th>
                    <th className="py-2 pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {(pins.data ?? []).map((p) => (
                    <tr key={p.id} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{p.student_name}</div>
                        <div className="text-xs text-muted-foreground">{p.matric_number}</div>
                      </td>
                      <td className="py-2 pr-3">{p.session_name}</td>
                      <td className="py-2 pr-3">{p.semester}</td>
                      <td className="py-2 pr-3 capitalize">{p.source}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[p.status] ?? ""}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{p.views}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">···{p.pin_last4}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="py-2 text-right">
                        {p.status !== "disabled" && (
                          <Button size="sm" variant="ghost" onClick={() => handleDisable(p.id)}>
                            <Ban className="mr-1.5 h-3.5 w-3.5" /> Disable
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {pins.data?.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        No PINs issued yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Payment records ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment records</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Reference</th>
                    <th className="py-2 pr-3">Session</th>
                    <th className="py-2 pr-3">Semester</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(payments.data ?? []).map((p) => (
                    <tr key={p.id} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{p.student_name}</div>
                        <div className="text-xs text-muted-foreground">{p.matric_number}</div>
                      </td>
                      <td className="py-2 pr-3">₦{Number(p.amount).toLocaleString()}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{p.reference}</td>
                      <td className="py-2 pr-3">{p.session_name}</td>
                      <td className="py-2 pr-3">{p.semester}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[p.status] ?? ""}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {payments.data?.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No payments recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-serif text-xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function ManualIssuanceCard({
  sessions,
  onIssued,
}: {
  sessions: { id: string; name: string }[];
  onIssued: () => void;
}) {
  const generate = useServerFn(adminGenerateManualPin);
  const [matric, setMatric] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [semester, setSemester] = useState<"First" | "Second" | "">("");
  const [issuing, setIssuing] = useState(false);
  const [result, setResult] = useState<{ pin: string; voucherUrl: string | null; studentName: string } | null>(null);

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    if (!sessionId || !semester) {
      toast.error("Select a session and semester.");
      return;
    }
    setIssuing(true);
    setResult(null);
    try {
      const res = await generate({ data: { matric_number: matric, session_id: sessionId, semester } });
      setResult({ pin: res.pin, voucherUrl: res.voucherUrl, studentName: res.studentName });
      onIssued();
      setMatric("");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIssuing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manually issue a PIN</CardTitle>
        <p className="text-xs text-muted-foreground">
          For students paying in person at the registry. Follows the exact same security rules as an online purchase.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleGenerate} className="grid gap-4 sm:grid-cols-4">
          <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
            <Label>Student / Matric Number</Label>
            <Input value={matric} onChange={(e) => setMatric(e.target.value)} required />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <Label>Session</Label>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select session</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <Label>Semester</Label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value as "First" | "Second")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select semester</option>
              <option value="First">First Semester</option>
              <option value="Second">Second Semester</option>
            </select>
          </label>
          <div className="sm:col-span-4">
            <Button type="submit" disabled={issuing}>
              {issuing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate &amp; Issue PIN
            </Button>
          </div>
        </form>

        {result && (
          <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
            <p className="font-semibold text-foreground">PIN issued for {result.studentName}</p>
            <p className="mt-1 font-mono text-lg tracking-wider text-primary">{result.pin}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              This is shown once — it will not be retrievable in plain text again. Print or hand over the voucher now.
            </p>
            {result.voucherUrl && (
              <Button asChild size="sm" className="mt-3">
                <a href={result.voucherUrl} target="_blank" rel="noreferrer" download>
                  Download voucher PDF
                </a>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
