import { createReveniumConfig, createMockFetch } from "../../helpers/fixtures";
import type { LiteLLMConfig } from "../../../src/litellm/types";

const originalFetch = global.fetch;

let sendReveniumMetrics: typeof import("../../../src/litellm/tracking").sendReveniumMetrics;
let extractUsageFromResponse: typeof import("../../../src/litellm/tracking").extractUsageFromResponse;
let setLiteLLMConfig: typeof import("../../../src/litellm/http-client").setLiteLLMConfig;
let setConfig: typeof import("../../../src/_core/config/manager").setConfig;
let resetConfig: typeof import("../../../src/_core/config/manager").resetConfig;

const testLiteLLMConfig: LiteLLMConfig = {
  reveniumMeteringApiKey: "hak_test_key",
  reveniumMeteringBaseUrl: "https://api.revenium.ai",
  litellmProxyUrl: "http://localhost:4000",
};

const baseMetrics = {
  requestId: "req-001",
  model: "openai/gpt-4",
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150,
  duration: 1500,
  finishReason: "stop",
  isStreamed: false,
};

beforeEach(async () => {
  jest.resetModules();
  process.env.AWS_REGION = "us-east-1";

  const manager = await import("../../../src/_core/config/manager");
  const tracking = await import("../../../src/litellm/tracking");
  const httpClient = await import("../../../src/litellm/http-client");

  sendReveniumMetrics = tracking.sendReveniumMetrics;
  extractUsageFromResponse = tracking.extractUsageFromResponse;
  setLiteLLMConfig = httpClient.setLiteLLMConfig;
  setConfig = manager.setConfig;
  resetConfig = manager.resetConfig;

  setConfig(createReveniumConfig());
  setLiteLLMConfig(testLiteLLMConfig);
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.AWS_REGION;
  resetConfig();
  jest.restoreAllMocks();
});

describe("sendReveniumMetrics token field names", () => {
  it("sends inputTokenCount not inputTokens", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendReveniumMetrics(baseMetrics);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty("inputTokenCount", 100);
    expect(body).not.toHaveProperty("inputTokens");
  });

  it("sends outputTokenCount not outputTokens", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendReveniumMetrics(baseMetrics);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty("outputTokenCount", 50);
    expect(body).not.toHaveProperty("outputTokens");
  });

  it("sends totalTokenCount not totalTokens", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendReveniumMetrics(baseMetrics);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty("totalTokenCount", 150);
    expect(body).not.toHaveProperty("totalTokens");
  });

  it("preserves zero token counts without dropping fields", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendReveniumMetrics({
      ...baseMetrics,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty("inputTokenCount", 0);
    expect(body).toHaveProperty("outputTokenCount", 0);
    expect(body).toHaveProperty("totalTokenCount", 0);
  });

  it("sends all three token count fields with correct values", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendReveniumMetrics({
      ...baseMetrics,
      promptTokens: 200,
      completionTokens: 75,
      totalTokens: 275,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      inputTokenCount: 200,
      outputTokenCount: 75,
      totalTokenCount: 275,
    });
    expect(body).not.toHaveProperty("inputTokens");
    expect(body).not.toHaveProperty("outputTokens");
    expect(body).not.toHaveProperty("totalTokens");
  });

  it("sets outputTokenCount to 0 for embedding operations", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendReveniumMetrics({ ...baseMetrics, operationType: "EMBED" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty("outputTokenCount", 0);
    expect(body).toHaveProperty("operationType", "EMBED");
  });

  it("sends cached prompt tokens as cache read tokens", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendReveniumMetrics({ ...baseMetrics, cachedTokens: 42 });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty("cacheCreationTokenCount", 0);
    expect(body).toHaveProperty("cacheReadTokenCount", 42);
  });

  it("extracts OpenAI-compatible cached prompt tokens from response usage", () => {
    const usage = extractUsageFromResponse({
      id: "chatcmpl-001",
      object: "chat.completion",
      created: 1,
      model: "openai/gpt-4o-mini",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "hello" },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
        prompt_tokens_details: { cached_tokens: 33 },
      },
    });

    expect(usage).toMatchObject({
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
      cachedTokens: 33,
      finishReason: "stop",
    });
  });
});
