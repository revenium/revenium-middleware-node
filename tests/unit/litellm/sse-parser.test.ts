import type { RequestContext } from "../../../src/litellm/types";

jest.mock("../../../src/litellm/tracking", () => ({
  trackUsageAsync: jest.fn(),
}));

let StreamingResponseParser: typeof import("../../../src/litellm/sse-parser").StreamingResponseParser;
let trackUsageAsync: typeof import("../../../src/litellm/tracking").trackUsageAsync;

function streamFromText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe("StreamingResponseParser cache token metering", () => {
  beforeEach(async () => {
    jest.resetModules();

    const parserModule = await import("../../../src/litellm/sse-parser");
    const tracking = await import("../../../src/litellm/tracking");

    StreamingResponseParser = parserModule.StreamingResponseParser;
    trackUsageAsync = tracking.trackUsageAsync;

    jest.mocked(trackUsageAsync).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("preserves OpenAI-compatible cached prompt tokens from usage chunks", async () => {
    const requestContext: RequestContext = {
      url: "http://localhost:4000/v1/chat/completions",
      method: "POST",
      headers: {},
      body: null,
      startTime: Date.now(),
      metadata: {},
    };
    const parser = new StreamingResponseParser(
      "req-stream-001",
      "openai/gpt-4o-mini",
      requestContext,
      125,
    );

    const stream = streamFromText(
      [
        'data: {"id":"chatcmpl-001","choices":[{"delta":{"content":"hello"}}]}',
        'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":100,"completion_tokens":20,"total_tokens":120,"prompt_tokens_details":{"cached_tokens":44}}}',
        "data: [DONE]",
        "",
      ].join("\n"),
    );

    await parser.parseStream(stream);

    expect(trackUsageAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req-stream-001",
        promptTokens: 100,
        completionTokens: 20,
        totalTokens: 120,
        cachedTokens: 44,
        isStreamed: true,
      }),
    );
  });

  it("does not erase cached prompt tokens when a later usage chunk omits details", async () => {
    const requestContext: RequestContext = {
      url: "http://localhost:4000/v1/chat/completions",
      method: "POST",
      headers: {},
      body: null,
      startTime: Date.now(),
      metadata: {},
    };
    const parser = new StreamingResponseParser(
      "req-stream-002",
      "openai/gpt-4o-mini",
      requestContext,
      125,
    );

    const stream = streamFromText(
      [
        'data: {"choices":[{"delta":{"content":"hello"}}],"usage":{"prompt_tokens":100,"completion_tokens":20,"total_tokens":120,"prompt_tokens_details":{"cached_tokens":44}}}',
        'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":100,"completion_tokens":20,"total_tokens":120}}',
        "data: [DONE]",
        "",
      ].join("\n"),
    );

    await parser.parseStream(stream);

    expect(trackUsageAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req-stream-002",
        cachedTokens: 44,
      }),
    );
  });
});
