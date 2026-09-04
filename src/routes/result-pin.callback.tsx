import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, XCircle, Download } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { verifyPinPurchase } from "@/lib/result-pin.functions";

const Search = z.object({ reference: z.string().optional(), trxref: z.string().optional() });

export const Route = createFileRoute("/result-pin/callback")({
  head: () => ({ meta: [{ title: "Payment Confirmation — Kazaure College" }] }),
  validateSearch: (s) => Search.parse(s),
  component: CallbackPage,
});

type Outcome =
  | { state: "loading" }
  | { state: "success"; voucherUrl: string | null; alreadyProcessed: boolean }
  | { state: "error"; message: string };

function CallbackPage() {
  const { reference, trxref } = Route.useSearch();
  const ref = reference ?? trxref;
  const verify = useServerFn(verifyPinPurchase);
  const [outcome, setOutcome] = useState<Outcome>({ state: "loading" });

  useEffect(() => {
    if (!ref) {
      setOutcome({ state: "error", message: "No payment reference was supplied." });
      return;
    }
    verify({ data: { reference: ref } })
       .then((result) => setOutcome({ state: "success", voucherUrl: result.voucherUrl ?? null, alreadyProcessed: result.alreadyProcessed }))
      .catch((error) => setOutcome({ state: "error", message: (error as Error).message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  return (
    <PublicLayout>
      <div className="mx-auto max-w-lg px-4 py-20 md:px-6">
        <Card className="tsu-shadow">
          <CardContent className="space-y-5 p-8 text-center">
            {outcome.state === "loading" && (
              <>
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                <h1 className="font-serif text-xl font-bold text-foreground">Confirming your payment&hellip;</h1>
                <p className="text-sm text-muted-foreground">Please don't close this page. This only takes a moment.</p>
              </>
            )}

            {outcome.state === "success" && (
              <>
                <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
                <h1 className="font-serif text-2xl font-bold text-foreground">Payment Successful</h1>
                <p className="text-sm text-muted-foreground">Your Result PIN Voucher is ready.</p>
                <div className="flex flex-col gap-3 pt-2">
                  {outcome.voucherUrl ? (
                    <Button asChild size="lg">
                      <a href={outcome.voucherUrl} target="_blank" rel="noreferrer" download>
                        <Download className="mr-2 h-4 w-4" /> Download PIN Voucher
                      </a>
                    </Button>
                  ) : (
                    <p className="text-xs text-destructive">
                      Your PIN was saved, but the download link couldn't be generated right now. Visit{" "}
                      <Link to="/student/result-pins" className="underline">My Result PINs</Link> in the student portal to retry.
                    </p>
                  )}
                  <Button asChild variant="outline" size="lg">
                    <Link to="/check-result">Check Result</Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <Link to="/student/login">Go to Student Portal</Link>
                  </Button>
                </div>
              </>
            )}

            {outcome.state === "error" && (
              <>
                <XCircle className="mx-auto h-12 w-12 text-destructive" />
                <h1 className="font-serif text-2xl font-bold text-foreground">Payment Could Not Be Confirmed</h1>
                <p className="text-sm text-muted-foreground">{outcome.message}</p>
                <div className="flex flex-col gap-3 pt-2">
                  <Button asChild variant="outline">
                    <Link to="/result-pin/buy">Try Again</Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
