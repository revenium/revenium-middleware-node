import { createHmac } from "node:crypto";
import { verifySignature } from "../../../src/webhooks/verify-signature";

function backendSign(timestamp: number, body: Buffer, secret: string): string {
  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), body]);
  const mac = createHmac("sha256", Buffer.from(secret, "utf8"));
  return "sha256=" + mac.update(signedPayload).digest("hex");
}

function buildBackendHeaders(
  body: Buffer,
  currentSecret: string,
  previousSecret?: string,
  rotatedAt?: number,
): { signature: string; timestamp: string } {
  const timestamp = Math.floor(Date.now() / 1000);
  const signatures = [backendSign(timestamp, body, currentSecret)];

  if (previousSecret && rotatedAt !== undefined && timestamp < rotatedAt + 86400) {
    signatures.push(backendSign(timestamp, body, previousSecret));
  }

  return {
    signature: signatures.join(", "),
    timestamp: timestamp.toString(),
  };
}

describe("backend compatibility", () => {
  const secret = "rK7sB2-XYZ-9wQpVnH3qY4rT8uOmDcLkPaWeFsJgIyB";

  describe("deterministic vector (fixed timestamp)", () => {
    const timestamp = "1716400000";
    const body =
      '{"type":"webhook.test","eventId":"abc-123","timestamp":1716400000,"data":{"message":"test"}}';
    const bodyBuffer = Buffer.from(body, "utf8");

    const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), bodyBuffer]);
    const expectedHex = createHmac("sha256", secret).update(signedPayload).digest("hex");

    it("verifies a signature computed with the exact backend algorithm", () => {
      const result = verifySignature({
        payload: body,
        signatureHeader: `sha256=${expectedHex}`,
        timestampHeader: timestamp,
        secrets: [secret],
        toleranceSeconds: Infinity,
      });

      expect(result).toBe(true);
    });

    it("rejects when a single byte of the body is altered", () => {
      const altered = body.replace("test", "tes!");

      const result = verifySignature({
        payload: altered,
        signatureHeader: `sha256=${expectedHex}`,
        timestampHeader: timestamp,
        secrets: [secret],
        toleranceSeconds: Infinity,
      });

      expect(result).toBe(false);
    });

    it("rejects when the timestamp in the header differs from the signed one", () => {
      const result = verifySignature({
        payload: body,
        signatureHeader: `sha256=${expectedHex}`,
        timestampHeader: "1716400001",
        secrets: [secret],
        toleranceSeconds: Infinity,
      });

      expect(result).toBe(false);
    });
  });

  describe("live backend simulation (signRequestHeaders replica)", () => {
    const testPayload = Buffer.from(
      '{"type":"webhook.test","eventId":"evt-001","timestamp":1716400000,"data":{"message":"This is a test event from Revenium."}}',
      "utf8",
    );

    it("verifies single-secret dispatch", () => {
      const headers = buildBackendHeaders(testPayload, secret);

      expect(
        verifySignature({
          payload: testPayload,
          signatureHeader: headers.signature,
          timestampHeader: headers.timestamp,
          secrets: [secret],
        }),
      ).toBe(true);
    });

    it("verifies rotation overlap dispatch with new secret", () => {
      const newSecret = "newSec_Abc123Xyz";
      const oldSecret = secret;
      const rotatedAt = Math.floor(Date.now() / 1000);

      const headers = buildBackendHeaders(testPayload, newSecret, oldSecret, rotatedAt);

      expect(headers.signature.split(",").length).toBe(2);

      expect(
        verifySignature({
          payload: testPayload,
          signatureHeader: headers.signature,
          timestampHeader: headers.timestamp,
          secrets: [newSecret],
        }),
      ).toBe(true);
    });

    it("verifies rotation overlap dispatch with old secret", () => {
      const newSecret = "newSec_Abc123Xyz";
      const oldSecret = secret;
      const rotatedAt = Math.floor(Date.now() / 1000);

      const headers = buildBackendHeaders(testPayload, newSecret, oldSecret, rotatedAt);

      expect(
        verifySignature({
          payload: testPayload,
          signatureHeader: headers.signature,
          timestampHeader: headers.timestamp,
          secrets: [oldSecret],
        }),
      ).toBe(true);
    });

    it("rejects rotation dispatch when overlap window expired", () => {
      const newSecret = "newSec_Abc123Xyz";
      const oldSecret = secret;
      const rotatedAt = Math.floor(Date.now() / 1000) - 86400 - 60;

      const headers = buildBackendHeaders(testPayload, newSecret, oldSecret, rotatedAt);

      expect(headers.signature.split(",").length).toBe(1);

      expect(
        verifySignature({
          payload: testPayload,
          signatureHeader: headers.signature,
          timestampHeader: headers.timestamp,
          secrets: [oldSecret],
        }),
      ).toBe(false);
    });

    it("handles unicode payload correctly", () => {
      const unicodePayload = Buffer.from(
        '{"data":{"message":"Alerta: custo excedeu R$ 1.000,00 \u2014 acao necessaria"}}',
        "utf8",
      );
      const headers = buildBackendHeaders(unicodePayload, secret);

      expect(
        verifySignature({
          payload: unicodePayload,
          signatureHeader: headers.signature,
          timestampHeader: headers.timestamp,
          secrets: [secret],
        }),
      ).toBe(true);
    });

    it("handles empty body payload", () => {
      const emptyPayload = Buffer.from("", "utf8");
      const headers = buildBackendHeaders(emptyPayload, secret);

      expect(
        verifySignature({
          payload: emptyPayload,
          signatureHeader: headers.signature,
          timestampHeader: headers.timestamp,
          secrets: [secret],
        }),
      ).toBe(true);
    });

    it("handles large payload", () => {
      const largePayload = Buffer.from(
        JSON.stringify({ data: { bulk: "x".repeat(100_000) } }),
        "utf8",
      );
      const headers = buildBackendHeaders(largePayload, secret);

      expect(
        verifySignature({
          payload: largePayload,
          signatureHeader: headers.signature,
          timestampHeader: headers.timestamp,
          secrets: [secret],
        }),
      ).toBe(true);
    });
  });

  describe("Kotlin byte-level parity", () => {
    it("secret.toByteArray() in Kotlin = Buffer.from(secret, utf8) in Node", () => {
      const kotlinStyle = Buffer.from(secret, "utf8");
      const nodeStyle = Buffer.from(secret);
      expect(kotlinStyle.equals(nodeStyle)).toBe(true);
    });

    it("timestamp string concatenation matches Kotlin string template", () => {
      const ts = 1716400000;
      const kotlinTemplate = `${ts}.`;
      const manualConcat = ts.toString() + ".";
      expect(kotlinTemplate).toBe(manualConcat);
      expect(Buffer.from(kotlinTemplate).equals(Buffer.from(manualConcat))).toBe(true);
    });

    it("ByteArray + operator in Kotlin = Buffer.concat in Node", () => {
      const ts = 1716400000;
      const body = Buffer.from('{"test":true}', "utf8");
      const prefix = Buffer.from(`${ts}.`, "utf8");

      const concatenated = Buffer.concat([prefix, body]);
      const expected = Buffer.from(`${ts}.{"test":true}`, "utf8");

      expect(concatenated.equals(expected)).toBe(true);
    });
  });
});
