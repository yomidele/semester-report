import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { verifyResultDocument } from "@/lib/result-pin.functions";
import { useT, useLanguage, formatLocalizedDate } from "@/lib/i18n";

export const Route = createFileRoute("/verify-result/$code")({
  head: () => ({ meta: [{ title: "Verify Result Document" }] }),
  component: VerifyResultPage,
});

// This is what a scanned QR code on a downloaded report card lands on. It
// confirms the document is authentic without exposing the student's full
// academic record — no scores, no subject list, just enough to confirm the
// named student really did receive a published result for that period.
function VerifyResultPage() {
  const { code } = Route.useParams();
  const t = useT();
  const { lang } = useLanguage();
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
                <h1 className="font-serif text-xl font-bold text-foreground">{t("verifyResult.checking")}</h1>
              </>
            ) : data?.valid ? (
              <>
                <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
                <h1 className="font-serif text-2xl font-bold text-foreground">{t("verifyResult.verified.title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("verifyResult.verified.body")}
                </p>
                <dl className="mt-4 space-y-2 rounded-md border border-border bg-secondary/40 p-4 text-left text-sm">
                  <Row label={t("verifyResult.verificationNo")} value={data.verification_number} />
                  <Row label={t("verifyResult.studentName")} value={data.student_name} />
                  <Row label={t("verifyResult.programme")} value={data.programme_name} />
                  <Row label={t("verifyResult.session")} value={data.session_name} />
                  <Row label={t("verifyResult.term")} value={data.semester === "First" ? t("checkResult.firstTerm") : data.semester === "Second" ? t("checkResult.secondTerm") : data.semester === "Third" ? t("checkResult.thirdTerm") : `${data.semester} Term`} />
                  <Row label={t("verifyResult.issued")} value={formatLocalizedDate(data.generated_at, lang)} />
                </dl>
                <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> {t("verifyResult.privacyNote")}
                </p>
              </>
            ) : (
              <>
                <XCircle className="mx-auto h-12 w-12 text-destructive" />
                <h1 className="font-serif text-2xl font-bold text-foreground">{t("verifyResult.notRecognized.title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("verifyResult.notRecognized.body")}
                </p>
              </>
            )}
            <Button asChild variant="outline" className="mt-2">
              <Link to="/">{t("apply.returnHome")}</Link>
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
