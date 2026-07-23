import { buildMetadataFields } from "../../../src/_core/metadata/metadata-builder";
import type { UsageMetadata } from "../../../src/_core/types/index";

describe("buildMetadataFields", () => {
  it("passes through all new trace fields from usageMetadata", () => {
    const metadata: UsageMetadata = {
      retryNumber: 3,
      environment: "production",
      region: "us-east-1",
      parentTransactionId: "txn-parent-001",
      transactionName: "synthesis-retry",
      traceType: "workflow",
      traceName: "recommendation-pipeline",
      ticketId: "FRONT-1543",
      operationSubtype: "function_call",
      errorReason: "schema_validation_failed",
      credentialAlias: "prod-key-1",
      mediationLatency: 150,
      systemFingerprint: "fp_abc123",
      temperature: 0.7,
    };

    const result = buildMetadataFields(metadata);

    expect(result.retryNumber).toBe(3);
    expect(result.environment).toBe("production");
    expect(result.region).toBe("us-east-1");
    expect(result.parentTransactionId).toBe("txn-parent-001");
    expect(result.transactionName).toBe("synthesis-retry");
    expect(result.traceType).toBe("workflow");
    expect(result.traceName).toBe("recommendation-pipeline");
    expect(result.ticketId).toBe("FRONT-1543");
    expect(result.operationSubtype).toBe("function_call");
    expect(result.errorReason).toBe("schema_validation_failed");
    expect(result.credentialAlias).toBe("prod-key-1");
    expect(result.mediationLatency).toBe(150);
    expect(result.systemFingerprint).toBe("fp_abc123");
    expect(result.temperature).toBe(0.7);
    expect(result.idempotencyKey).toBeUndefined();
  });

  it("passes through idempotencyKey from usageMetadata", () => {
    const result = buildMetadataFields({ idempotencyKey: "custom-key-123" });
    expect(result.idempotencyKey).toBe("custom-key-123");
  });

  it("preserves retryNumber: 0 as a valid value", () => {
    const metadata: UsageMetadata = { retryNumber: 0 };
    const result = buildMetadataFields(metadata);
    expect(result.retryNumber).toBe(0);
  });

  it("omits undefined fields from result", () => {
    const metadata: UsageMetadata = { environment: "staging" };
    const result = buildMetadataFields(metadata);
    expect(result.environment).toBe("staging");
    expect(result.retryNumber).toBeUndefined();
    expect(result.region).toBeUndefined();
  });

  it("preserves existing fields alongside new ones", () => {
    const metadata: UsageMetadata = {
      traceId: "trace-001",
      taskType: "synthesis",
      agent: "recommender",
      retryNumber: 1,
      parentTransactionId: "txn-parent-001",
    };

    const result = buildMetadataFields(metadata);

    expect(result.traceId).toBe("trace-001");
    expect(result.taskType).toBe("synthesis");
    expect(result.agent).toBe("recommender");
    expect(result.retryNumber).toBe(1);
    expect(result.parentTransactionId).toBe("txn-parent-001");
  });
});
