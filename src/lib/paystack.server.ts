// Server-only Paystack client. Secret key never leaves the server.
const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Paystack is not configured. Set the PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY environment variables, then enable Paystack in Admin \u2192 Settings.",
    );
  }
  return key;
}

interface InitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export async function paystackInitialize(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<InitializeResult> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      currency: "NGN",
      metadata: params.metadata,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json?.message ?? "Could not start Paystack payment. Please try again.");
  }
  return json.data as InitializeResult;
}

export interface PaystackVerifyData {
  status: "success" | "failed" | "abandoned" | string;
  reference: string;
  amount: number; // kobo
  currency: string;
  paid_at: string | null;
  customer: { email: string };
}

export async function paystackVerify(reference: string): Promise<PaystackVerifyData> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json?.message ?? "Could not verify payment with Paystack.");
  }
  return json.data as PaystackVerifyData;
}

/** Verifies the x-paystack-signature header on incoming webhook requests (HMAC SHA512 of the raw body). */
export async function verifyPaystackWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const { createHmac } = await import("node:crypto");
  const hash = createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  return hash === signatureHeader;
}

export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}
