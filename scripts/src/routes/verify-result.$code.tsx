import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { verifyResultDocument } from "@/lib/result-pin.functions";

export const Route = createFileRoute("/verify-result/$code")({
  head: () => ({ meta: [{ title: "Verify Result Document" }] }),
  component: VerifyResultPage,
});

// This is what a scanned QR code on a downloaded report card lands on. It
// confirms the document is authentic without exposing the student's full
// academic record — no scores, no course list, just enough to confirm the
// named student really did receive a published result for that period.
function VerifyResultPage() {
  const { code } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["verify-result", code],
    queryFn: () => verifyResultDocument({ data: { code } }),
  });

  return (
    <PublicLayout>
      <div className="mx-auto max-w-lg px-4 py-20 md:px-6">
        <Card className="tsu-shadow">
          <CardContent className="space-y-5 p-8 text-center">
            {isLoading ? (
              <>
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                <h1 className="font-serif text-xl font-bold text-foreground">Checking document&hellip;</h1>
              </>
            ) : data?.valid ? (
              <>
                <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
                <h1 className="font-serif text-2xl font-bold text-foreground">Document Verified</h1>
                <p className="text-sm text-muted-foreground">
                  This is a genuine result report card issued by this institution.
                </p>
                <dl className="mt-4 space-y-2 rounded-md border border-border bg-secondary/40 p-4 text-left text-sm">
                  <Row label="Verification No." value={data.verification_number} />
                  <Row label="Student Name" value={data.student_name} />
                  <Row label="Programme" value={data.programme_name} />
                  <Row label="Session" value={data.session_name} />
                  <Row label="Semester" value={`${data.semester} Semester`} />
                  <Row label="Issued" value={new Date(data.generated_at).toLocaleDateString()} />
                </dl>
                <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Scores and grades are not shown here for the student's privacy.
                </p>
              </>
            ) : (
              <>
                <XCircle className="mx-auto h-12 w-12 text-destructive" />
                <h1 className="font-serif text-2xl font-bold text-foreground">Not a Recognized Document</h1>
                <p className="text-sm text-muted-foreground">
                  This verification code doesn't match any result report card issued by this institution.
                </p>
              </>
            )}
            <Button asChild variant="outline" className="mt-2">
              <Link to="/">Return home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
