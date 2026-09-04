import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Download, KeyRound } from "lucide-react";
import { ProtectedStudent } from "@/components/ProtectedStudent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMyResultPins, getMyVoucherDownloadUrl } from "@/lib/result-pin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/student/result-pins")({
  head: () => ({ meta: [{ title: "My Result PINs — Kazaure College" }] }),
  component: () => (
    <ProtectedStudent>
      <MyResultPinsPage />
    </ProtectedStudent>
  ),
});

const STATUS_STYLE: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  exhausted: "bg-amber-100 text-amber-800",
  expired: "bg-muted text-muted-foreground",
  disabled: "bg-destructive/10 text-destructive",
};

function MyResultPinsPage() {
  const pinsQuery = useQuery({ queryKey: ["my-result-pins"], queryFn: () => getMyResultPins() });
  const getVoucherUrl = useServerFn(getMyVoucherDownloadUrl);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function download(pinId: string) {
    setDownloadingId(pinId);
    try {
      const { url } = await getVoucherUrl({ data: { pin_id: pinId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-2xl font-bold">
            <KeyRound className="h-5 w-5 text-primary" /> My Result PINs
          </h2>
          <p className="text-sm text-muted-foreground">
            PIN vouchers you've purchased. Each PIN only works for the session and semester it was issued for.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/result-pin/buy">Buy another PIN</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Purchase history</CardTitle>
        </CardHeader>
        <CardContent>
          {pinsQuery.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : !pinsQuery.data || pinsQuery.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              You haven't purchased a Result PIN yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Session</th>
                    <th className="py-2 pr-3">Semester</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Views</th>
                    <th className="py-2 pr-3">Purchase Date</th>
                    <th className="py-2 pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {pinsQuery.data.map((pin) => (
                    <tr key={pin.id} className="border-b border-border/60">
                      <td className="py-3 pr-3 font-medium">{pin.session_name}</td>
                      <td className="py-3 pr-3">{pin.semester}</td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[pin.status] ?? ""}`}>
                          {pin.status}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">{pin.views_used}/{pin.max_views}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{new Date(pin.created_at).toLocaleDateString()}</td>
                      <td className="py-3 text-right">
                        {pin.has_voucher ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={downloadingId === pin.id}
                            onClick={() => download(pin.id)}
                          >
                            {downloadingId === pin.id ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="mr-2 h-3.5 w-3.5" />
                            )}
                            Download
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unavailable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
