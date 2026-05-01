import { buildPayload, PayloadParams } from "../../../src/_core/metering/payload-builder";

const ENV_KEYS = [
  "REVENIUM_ENVIRONMENT",
  "REVENIUM_REGION",
  "REVENIUM_CREDENTIAL_ALIAS",
  "REVENIUM_TRACE_TYPE",
  "REVENIUM_TRACE_NAME",
  "REVENIUM_PARENT_TRANSACTION_ID",
  "REVENIUM_TRANSACTION_NAME",
  "REVENIUM_RETRY_NUMBER",
  "NODE_ENV",
  "DEPLOYMENT_ENV",
  "AWS_REGION",
  "AZURE_REGION",
  "GCP_REGION",
];

let savedEnv: Record<string, string | undefined>;

function createParams(overrides: Partial<PayloadParams> = {}): PayloadParams {
  return {
    operationType: "CHAT",
    model: "claude-sonnet-4-20250514",
    startTime: Date.now() - 1000,
    duration: 1000,
    provider: "Anthropic",
    modelSource: "ANTHROPIC",
    middlewareSource: "revenium-anthropic-node",
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    stopReason: "end_turn",
    isStreamed: false,
    ...overrides,
  };
}

beforeEach(async () => {
  jest.resetModules();
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  const { resetRegionCache } = await import("../../../src/_core/metadata/trace-fields");
  resetRegionCache();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] !== undefined) {
      process.env[key] = savedEnv[key];
    } else {
      delete process.env[key];
    }
  }
});

describe("buildPayload precedence", () => {
  it("user-set values override env vars", async () => {
    process.env.REVENIUM_ENVIRONMENT = "from-env";
    process.env.REVENIUM_RETRY_NUMBER = "2";
    process.env.REVENIUM_PARENT_TRANSACTION_ID = "env-parent";
    process.env.REVENIUM_TRANSACTION_NAME = "env-name";
    process.env.REVENIUM_CREDENTIAL_ALIAS = "env-alias";
    process.env.REVENIUM_TRACE_TYPE = "env-trace-type";
    process.env.REVENIUM_TRACE_NAME = "env-trace-name";

    const params = createParams({
      usageMetadata: {
        environment: "user-production",
        retryNumber: 5,
        parentTransactionId: "user-parent-txn",
        transactionName: "user-txn-name",
        credentialAlias: "user-alias",
        traceType: "user-trace-type",
        traceName: "user-trace-name",
      },
    });

    const payload = await buildPayload(params);

    expect(payload.environment).toBe("user-production");
    expect(payload.retryNumber).toBe(5);
    expect(payload.parentTransactionId).toBe("user-parent-txn");
    expect(payload.transactionName).toBe("user-txn-name");
    expect(payload.credentialAlias).toBe("user-alias");
    expect(payload.traceType).toBe("user-trace-type");
    expect(payload.traceName).toBe("user-trace-name");
  });

  it("falls back to env vars when user provides no metadata", async () => {
    process.env.REVENIUM_ENVIRONMENT = "staging";
    process.env.REVENIUM_RETRY_NUMBER = "1";
    process.env.REVENIUM_CREDENTIAL_ALIAS = "env-alias";

    const params = createParams();
    const payload = await buildPayload(params);

    expect(payload.environment).toBe("staging");
    expect(payload.retryNumber).toBe(1);
    expect(payload.credentialAlias).toBe("env-alias");
  });

  it("preserves retryNumber: 0 from user metadata over env var", async () => {
    process.env.REVENIUM_RETRY_NUMBER = "3";

    const params = createParams({
      usageMetadata: { retryNumber: 0 },
    });

    const payload = await buildPayload(params);

    expect(payload.retryNumber).toBe(0);
  });

  it("carries new fields to the wire payload", async () => {
    const params = createParams({
      usageMetadata: {
        operationSubtype: "function_call",
        errorReason: "schema_validation_failed",
        mediationLatency: 200,
        systemFingerprint: "fp_xyz",
        temperature: 0.3,
      },
    });

    const payload = await buildPayload(params);

    expect(payload.operationSubtype).toBe("function_call");
    expect(payload.environment).toBeUndefined();
    expect(payload.region).toBeUndefined();
  });
});
