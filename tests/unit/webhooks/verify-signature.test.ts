import { createHmac } from "node:crypto";
import { verifySignature } from "../../../src/webhooks/verify-signature";

function sign(timestamp: string, body: string, secret: string): string {
  const signedPayload = Buffer.concat([
    Buffer.from(`${timestamp}.`, "utf8"),
    Buffer.from(body, "utf8"),
  ]);
  return "sha256=" + createHmac("sha256", secret).update(signedPayload).digest("hex");
}

function nowSeconds(): string {
  return Math.floor(Date.now() / 1000).toString();
}

describe("verifySignature", () => {
  const secret = "whsec_test_secret_key_abc123";
  const body = '{"type":"webhook.test","data":{"message":"hello"}}';

  it("returns true for valid single-secret signature", () => {
    const ts = nowSeconds();
    const sig = sign(ts, body, secret);

    expect(
      verifySignature({
        payload: body,
        signatureHeader: sig,
        timestampHeader: ts,
        secrets: [secret],
      }),
    ).toBe(true);
  });

  it("returns true for valid signature with Buffer payload", () => {
    const ts = nowSeconds();
    const sig = sign(ts, body, secret);

    expect(
      verifySignature({
        payload: Buffer.from(body, "utf8"),
        signatureHeader: sig,
        timestampHeader: ts,
        secrets: [secret],
      }),
    ).toBe(true);
  });

  it("returns true during rotation overlap with two secrets and signatures", () => {
    const ts = nowSeconds();
    const newSecret = "whsec_new_secret";
    const oldSecret = "whsec_old_secret";
    const sigNew = sign(ts, body, newSecret);
    const sigOld = sign(ts, body, oldSecret);
    const header = `${sigNew}, ${sigOld}`;

    expect(
      verifySignature({
        payload: body,
        signatureHeader: header,
        timestampHeader: ts,
        secrets: [newSecret, oldSecret],
      }),
    ).toBe(true);
  });

  it("returns true when only one of multiple secrets matches", () => {
    const ts = nowSeconds();
    const sig = sign(ts, body, secret);

    expect(
      verifySignature({
        payload: body,
        signatureHeader: sig,
        timestampHeader: ts,
        secrets: ["wrong_secret", secret],
      }),
    ).toBe(true);
  });

  it("returns false when timestamp exceeds default tolerance", () => {
    const ts = (Math.floor(Date.now() / 1000) - 400).toString();
    const sig = sign(ts, body, secret);

    expect(
      verifySignature({
        payload: body,
        signatureHeader: sig,
        timestampHeader: ts,
        secrets: [secret],
      }),
    ).toBe(false);
  });

  it("returns false when timestamp exceeds custom tolerance", () => {
    const ts = (Math.floor(Date.now() / 1000) - 15).toString();
    const sig = sign(ts, body, secret);

    expect(
      verifySignature({
        payload: body,
        signatureHeader: sig,
        timestampHeader: ts,
        secrets: [secret],
        toleranceSeconds: 10,
      }),
    ).toBe(false);
  });

  it("returns false for malformed header without sha256= prefix", () => {
    const ts = nowSeconds();

    expect(
      verifySignature({
        payload: body,
        signatureHeader: "md5=abc123,hmac=xyz",
        timestampHeader: ts,
        secrets: [secret],
      }),
    ).toBe(false);
  });

  it("returns false for empty signature header", () => {
    const ts = nowSeconds();

    expect(
      verifySignature({
        payload: body,
        signatureHeader: "",
        timestampHeader: ts,
        secrets: [secret],
      }),
    ).toBe(false);
  });

  it("returns false for empty secrets array", () => {
    const ts = nowSeconds();
    const sig = sign(ts, body, secret);

    expect(
      verifySignature({
        payload: body,
        signatureHeader: sig,
        timestampHeader: ts,
        secrets: [],
      }),
    ).toBe(false);
  });

  it("returns false when secret does not match", () => {
    const ts = nowSeconds();
    const sig = sign(ts, body, secret);

    expect(
      verifySignature({
        payload: body,
        signatureHeader: sig,
        timestampHeader: ts,
        secrets: ["completely_wrong_secret"],
      }),
    ).toBe(false);
  });

  it("returns false for non-numeric timestamp", () => {
    const sig = sign("notanumber", body, secret);

    expect(
      verifySignature({
        payload: body,
        signatureHeader: sig,
        timestampHeader: "notanumber",
        secrets: [secret],
      }),
    ).toBe(false);
  });

  it("produces same result for string and Buffer payload", () => {
    const ts = nowSeconds();
    const sig = sign(ts, body, secret);
    const opts = { signatureHeader: sig, timestampHeader: ts, secrets: [secret] };

    const fromString = verifySignature({ ...opts, payload: body });
    const fromBuffer = verifySignature({ ...opts, payload: Buffer.from(body, "utf8") });

    expect(fromString).toBe(true);
    expect(fromBuffer).toBe(true);
    expect(fromString).toBe(fromBuffer);
  });
});
