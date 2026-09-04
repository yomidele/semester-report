// These helpers are intentionally free of node:crypto so they can be safely
// referenced by TanStack server functions while Vite also builds the client.
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";

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

/** One-way hash of a PIN for storage. The raw PIN is never persisted. */
export function hashPin(pin: string, pepper: string): string {
  return bytesToHex(sha256(utf8ToBytes(`${pin.toUpperCase()}:${pepper}`)));
}

/** Constant-time comparison of a supplied PIN against a stored hash. */
export function verifyPinAgainstHash(pin: string, hash: string, pepper: string): boolean {
  const candidate = hexToBytes(hashPin(pin, pepper));
  let stored: Uint8Array;
  try {
    stored = hexToBytes(hash);
  } catch {
    return false;
  }
  if (candidate.length !== stored.length) return false;
  let difference = 0;
  for (let i = 0; i < candidate.length; i++) difference |= candidate[i] ^ stored[i];
  return difference === 0;
}

/** Internal payment reference sent to Paystack, e.g. "RPP-2026-9F3K7QAB". */
export function generatePaymentReference(): string {
  const year = new Date().getFullYear();
  const rand = bytesToHex(randomBytes(6)).toUpperCase();
  return `RPP-${year}-${rand}`;
}

/** Voucher number printed on the PDF, e.g. "RPV-2026-4F91K2". */
export function generateVoucherNumber(): string {
  const year = new Date().getFullYear();
  const rand = bytesToHex(randomBytes(4)).toUpperCase().slice(0, 6);
  return `RPV-${year}-${rand}`;
}

/** Result verification number for the QR code / /verify-result page, e.g. "RES-2026-8F92KD". */
export function generateVerificationNumber(): string {
  const year = new Date().getFullYear();
  const rand = bytesToHex(randomBytes(4)).toUpperCase().slice(0, 6);
  return `RES-${year}-${rand}`;
}
