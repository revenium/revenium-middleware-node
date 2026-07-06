import { createReveniumConfig, createMockFetch } from "../../helpers/fixtures";

let extractUsageFromResponse: typeof import("../../../src/anthropic/middleware").extractUsageFromResponse;
let extractUsageFromStream: typeof import("../../../src/anthropic/middleware").extractUsageFromStream;
let reconstructResponseFromChunks: typeof import("../../../src/anthropic/middleware").reconstructResponseFromChunks;
let trackUsageAsync: typeof import("../../../src/anthropic/middleware").trackUsageAsync;
let resetMeteringCircuitBreaker: typeof import("../../../src/_core/resilience/circuit-breaker").resetMeteringCircuitBreaker;
let setConfig: typeof import("../../../src/_core/config/manager").setConfig;
let resetConfig: typeof import("../../../src/_core/config/manager").resetConfig;

const originalFetch = global.fetch;

beforeEach(async () => {
  jest.resetModules();
  process.env.AWS_REGION = "us-east-1";

  const manager = await import("../../../src/_core/config/manager");
  const middleware = await import("../../../src/anthropic/middleware");
  const circuitBreaker = await import("../../../src/_core/resilience/circuit-breaker");

  extractUsageFromResponse = middleware.extractUsageFromResponse;
  extractUsageFromStream = middleware.extractUsageFromStream;
  reconstructResponseFromChunks = middleware.reconstructResponseFromChunks;
  trackUsageAsync = middleware.trackUsageAsync;
  resetMeteringCircuitBreaker = circuitBreaker.resetMeteringCircuitBreaker;
  setConfig = manager.setConfig;
  resetConfig = manager.resetConfig;

  setConfig(createReveniumConfig());
});

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
  delete process.env.AWS_REGION;
  resetMeteringCircuitBreaker();
  resetConfig();
});

describe("extractUsageFromResponse", () => {
  it("maps both cache creation and read tokens", () => {
    const result = extractUsageFromResponse({
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 25,
        cache_read_input_tokens: 15,
      },
      stop_reason: "end_turn",
    });

    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
    expect(result.cacheCreationTokens).toBe(25);
    expect(result.cacheReadTokens).toBe(15);
    expect(result.stopReason).toBe("end_turn");
  });

  it("returns undefined for missing cache tokens", () => {
    const result = extractUsageFromResponse({
      usage: { input_tokens: 100, output_tokens: 50 },
      stop_reason: "end_turn",
    });

    expect(result.cacheCreationTokens).toBeUndefined();
    expect(result.cacheReadTokens).toBeUndefined();
  });

  it("handles only cache creation present", () => {
    const result = extractUsageFromResponse({
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 30,
      },
    });

    expect(result.cacheCreationTokens).toBe(30);
    expect(result.cacheReadTokens).toBeUndefined();
  });

  it("handles only cache read present", () => {
    const result = extractUsageFromResponse({
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 20,
      },
    });

    expect(result.cacheCreationTokens).toBeUndefined();
    expect(result.cacheReadTokens).toBe(20);
  });

  it("handles missing usage gracefully", () => {
    const result = extractUsageFromResponse({});

    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.cacheCreationTokens).toBeUndefined();
    expect(result.cacheReadTokens).toBeUndefined();
  });
});

describe("extractUsageFromStream", () => {
  it("extracts cache tokens from message_start chunk", () => {
    const chunks = [
      {
        type: "message_start",
        message: {
          usage: {
            input_tokens: 100,
            cache_creation_input_tokens: 25,
            cache_read_input_tokens: 15,
          },
        },
      },
      {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Hello" },
      },
      {
        usage: { output_tokens: 50 },
      },
    ];

    const result = extractUsageFromStream(chunks);

    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
    expect(result.cacheCreationTokens).toBe(25);
    expect(result.cacheReadTokens).toBe(15);
  });

  it("extracts cache tokens from top-level usage chunk", () => {
    const chunks = [
      {
        usage: {
          input_tokens: 80,
          output_tokens: 40,
          cache_creation_input_tokens: 10,
          cache_read_input_tokens: 5,
        },
      },
    ];

    const result = extractUsageFromStream(chunks);

    expect(result.inputTokens).toBe(80);
    expect(result.outputTokens).toBe(40);
    expect(result.cacheCreationTokens).toBe(10);
    expect(result.cacheReadTokens).toBe(5);
  });

  it("extracts cache tokens from delta.usage chunk", () => {
    const chunks = [
      {
        delta: {
          usage: {
            input_tokens: 60,
            output_tokens: 30,
            cache_creation_input_tokens: 8,
            cache_read_input_tokens: 3,
          },
        },
      },
    ];

    const result = extractUsageFromStream(chunks);

    expect(result.cacheCreationTokens).toBe(8);
    expect(result.cacheReadTokens).toBe(3);
  });

  it("returns undefined when no cache tokens in stream", () => {
    const chunks = [
      {
        type: "message_start",
        message: { usage: { input_tokens: 100 } },
      },
      { usage: { output_tokens: 50 } },
    ];

    const result = extractUsageFromStream(chunks);

    expect(result.cacheCreationTokens).toBeUndefined();
    expect(result.cacheReadTokens).toBeUndefined();
  });

  it("handles empty chunk array", () => {
    const result = extractUsageFromStream([]);

    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.cacheCreationTokens).toBeUndefined();
    expect(result.cacheReadTokens).toBeUndefined();
  });
});

describe("reconstructResponseFromChunks", () => {
  it("preserves cache tokens in reconstructed response", () => {
    const chunks = [
      {
        type: "message_start",
        message: {
          usage: {
            input_tokens: 100,
            cache_creation_input_tokens: 25,
            cache_read_input_tokens: 15,
          },
        },
      },
      {
        type: "content_block_start",
        content_block: { type: "text", text: "" },
        index: 0,
      },
      {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Hello" },
        index: 0,
      },
      {
        type: "message_delta",
        delta: { stop_reason: "end_turn" },
      },
      {
        usage: { output_tokens: 50 },
      },
    ];

    const result = reconstructResponseFromChunks(chunks, "claude-3-5-sonnet-20241022");

    expect(result.usage.cache_creation_input_tokens).toBe(25);
    expect(result.usage.cache_read_input_tokens).toBe(15);
    expect(result.usage.input_tokens).toBe(100);
    expect(result.usage.output_tokens).toBe(50);
    expect(result.model).toBe("claude-3-5-sonnet-20241022");
  });

  it("handles chunks without cache tokens", () => {
    const chunks = [
      {
        type: "message_start",
        message: { usage: { input_tokens: 100 } },
      },
      {
        type: "content_block_start",
        content_block: { type: "text", text: "" },
        index: 0,
      },
      {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Hi" },
        index: 0,
      },
      {
        type: "message_delta",
        delta: { stop_reason: "end_turn" },
      },
    ];

    const result = reconstructResponseFromChunks(chunks, "claude-3-5-sonnet-20241022");

    expect(result.usage.cache_creation_input_tokens).toBeUndefined();
    expect(result.usage.cache_read_input_tokens).toBeUndefined();
  });
});

describe("trackUsageAsync propagation", () => {
  async function flushPromises(): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve));
  }

  it("propagates cache tokens through to sendToRevenium payload", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    trackUsageAsync({
      requestId: "req-anthropic-001",
      model: "claude-3-5-sonnet-20241022",
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationTokens: 25,
      cacheReadTokens: 15,
      duration: 1500,
      isStreamed: false,
      stopReason: "end_turn",
      requestTime: new Date(),
      responseTime: new Date(),
    });

    await flushPromises();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty("cacheCreationTokenCount", 25);
    expect(body).toHaveProperty("cacheReadTokenCount", 15);
    expect(body).toHaveProperty("provider", "Anthropic");
  });

  it("sends zero cache tokens when none provided", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    trackUsageAsync({
      requestId: "req-anthropic-002",
      model: "claude-3-5-sonnet-20241022",
      inputTokens: 100,
      outputTokens: 50,
      duration: 1500,
      isStreamed: false,
      stopReason: "end_turn",
      requestTime: new Date(),
      responseTime: new Date(),
    });

    await flushPromises();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty("cacheCreationTokenCount", 0);
    expect(body).toHaveProperty("cacheReadTokenCount", 0);
  });
});
