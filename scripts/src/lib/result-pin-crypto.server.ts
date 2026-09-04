// Server-only. Never import this from a route/*.functions.ts file that ships to the client bundle.
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

// Unambiguous charset: no 0/O, 1/I/L, to reduce transcription errors on the printed voucher.
const PIN_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Generates a cryptographically-random PIN like "8K7P-42XM-91QA". */
export function generateSecurePin(): string {
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let group = "";
    const bytes = randomBytes(4);
    for (let i = 0; i < 4; i++) {
      group += PIN_ALPHABET[bytes[i] % PIN_ALPHABET.length];
    }
    groups.push(group);
  }
  return groups.join("-");
}

function pepper(): string {
  const p = process.env.RESULT_PIN_HASH_PEPPER;
  if (!p) throw new Error("Server misconfiguration: RESULT_PIN_HASH_PEPPER is not set.");
  return p;
}

/** One-way hash of a PIN for storage. The raw PIN is never persisted. */
export function hashPin(pin: string): string {
  return createHash("sha256").update(`${pin.toUpperCase()}:${pepper()}`).digest("hex");
}

/** Constant-time comparison of a supplied PIN against a stored hash. */
export function verifyPinAgainstHash(pin: string, hash: string): boolean {
  const candidate = Buffer.from(hashPin(pin), "hex");
  const stored = Buffer.from(hash, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

/** Internal payment reference sent to Paystack, e.g. "RPP-2026-9F3K7QAB". */
export function generatePaymentReference(): string {
  const year = new Date().getFullYear();
  const rand = randomBytes(6).toString("hex").toUpperCase();
  return `RPP-${year}-${rand}`;
}

/** Voucher number printed on the PDF, e.g. "RPV-2026-4F91K2". */
export function generateVoucherNumber(): string {
  const year = new Date().getFullYear();
  const rand = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `RPV-${year}-${rand}`;
}

/** Result verification number for the QR code / /verify-result page, e.g. "RES-2026-8F92KD". */
export function generateVerificationNumber(): string {
  const year = new Date().getFullYear();
  const rand = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `RES-${year}-${rand}`;
}
