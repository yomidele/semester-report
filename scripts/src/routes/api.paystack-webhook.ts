import { createFileRoute } from "@tanstack/react-router";
import { verifyPaystackWebhookSignature } from "@/lib/paystack.server";
import { verifyAndFulfilPinPayment } from "@/lib/result-pin.functions";

// Paystack calls this directly (not through the client-side RPC layer).
// Server-side verification here is a safety net in case a student closes the
// tab before the callback page finishes — the callback page and this webhook
// both funnel into the same idempotent verifyAndFulfilPinPayment().
export const Route = createFileRoute("/api/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-paystack-signature");

        const validSignature = await verifyPaystackWebhookSignature(rawBody, signature).catch(() => false);
        if (!validSignature) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: { event?: string; data?: { reference?: string } };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        if (event.event === "charge.success" && event.data?.reference) {
          try {
            await verifyAndFulfilPinPayment(event.data.reference);
          } catch (error) {
            // Log and still 200 — Paystack retries on non-2xx, and retrying a
            // failed verification (e.g. student record deleted) won't help.
            console.error("[paystack-webhook] fulfilment error:", (error as Error).message);
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
