import { ReveniumConfig, ReveniumPayload, OperationType } from "../../src/_core/types/index";

export function createReveniumConfig(overrides: Partial<ReveniumConfig> = {}): ReveniumConfig {
  return {
    reveniumApiKey: "hak_tenant_abc123xyz",
    reveniumBaseUrl: "https://api.revenium.ai",
    ...overrides,
  };
}

export function createPayload(overrides: Partial<ReveniumPayload> = {}): ReveniumPayload {
  return {
    transactionId: "txn-001",
    operationType: "CHAT" as OperationType,
    costType: "AI",
    model: "gpt-4",
    provider: "OpenAI",
    modelSource: "OPENAI",
    middlewareSource: "revenium-openai-node",
    requestTime: new Date().toISOString(),
    responseTime: new Date().toISOString(),
    requestDuration: 1500,
    completionStartTime: new Date().toISOString(),
    inputTokenCount: 100,
    outputTokenCount: 50,
    totalTokenCount: 150,
    reasoningTokenCount: undefined,
    cacheCreationTokenCount: undefined,
    cacheReadTokenCount: undefined,
    stopReason: "END",
    isStreamed: false,
    ...overrides,
  };
}

export function createMockFetch(
  response: Partial<Response> & { headers?: Record<string, string> } = {},
): jest.Mock {
  const { headers: headerOverrides, ...rest } = response;
  const headerMap = new Map(Object.entries(headerOverrides ?? {}));
  return jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(""),
      headers: { get: (name: string) => headerMap.get(name) ?? null },
      ...rest,
    } as unknown as Response),
  );
}
