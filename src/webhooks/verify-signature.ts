import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifySignatureOptions {
  payload: Buffer | string;
  signatureHeader: string;
  timestampHeader: string;
  secrets: string[];
  toleranceSeconds?: number;
}

const DEFAULT_TOLERANCE_SECONDS = 300;
const SIGNATURE_PREFIX = "sha256=";

function parseSignatures(header: string): string[] {
  return header
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.startsWith(SIGNATURE_PREFIX))
    .map((s) => s.slice(SIGNATURE_PREFIX.length));
}

function computeHmac(secret: string, payload: Buffer): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifySignature(opts: VerifySignatureOptions): boolean {
  const toleranceSeconds = opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;

  if (opts.secrets.length === 0) return false;

  const signatures = parseSignatures(opts.signatureHeader);
  if (signatures.length === 0) return false;

  const timestamp = parseInt(opts.timestampHeader, 10);
  if (isNaN(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;

  const bodyBuffer = Buffer.isBuffer(opts.payload)
    ? opts.payload
    : Buffer.from(opts.payload, "utf8");

  const signedPayload = Buffer.concat([
    Buffer.from(`${opts.timestampHeader}.`, "utf8"),
    bodyBuffer,
  ]);

  for (const secret of opts.secrets) {
    const expected = computeHmac(secret, signedPayload);
    for (const sig of signatures) {
      if (safeCompare(expected, sig)) return true;
    }
  }

  return false;
}
