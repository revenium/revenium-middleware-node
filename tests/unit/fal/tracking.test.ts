import { createReveniumConfig, createMockFetch } from "../../helpers/fixtures";

const originalFetch = global.fetch;

let sendFalMetrics: typeof import("../../../src/fal/tracking").sendFalMetrics;
let setConfig: typeof import("../../../src/_core/config/manager").setConfig;
let resetConfig: typeof import("../../../src/_core/config/manager").resetConfig;

beforeEach(async () => {
  jest.resetModules();
  process.env.AWS_REGION = "us-east-1";

  const manager = await import("../../../src/_core/config/manager");
  const tracking = await import("../../../src/fal/tracking");

  sendFalMetrics = tracking.sendFalMetrics;
  setConfig = manager.setConfig;
  resetConfig = manager.resetConfig;

  setConfig(createReveniumConfig());
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.AWS_REGION;
  resetConfig();
  jest.restoreAllMocks();
});

describe("sendFalMetrics IMAGE tracking", () => {
  it("sends IMAGE payload with correct fields", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendFalMetrics({
      endpointId: "fal-ai/flux/dev",
      operationType: "IMAGE",
      startTime: Date.now() - 2000,
      duration: 2000,
      input: { prompt: "a cat", num_images: 2 },
      result: {
        images: [
          { url: "https://example.com/1.png", width: 1024, height: 1024 },
          { url: "https://example.com/2.png", width: 1024, height: 1024 },
        ],
      },
      isStreamed: false,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operationType).toBe("IMAGE");
    expect(body.provider).toBe("fal_ai");
    expect(body.modelSource).toBe("FAL_AI");
    expect(body.model).toBe("fal-ai/flux/dev");
    expect(body.middlewareSource).toBe("revenium-fal-node");
    expect(body.inputTokenCount).toBeNull();
    expect(body.outputTokenCount).toBeNull();
    expect(body.totalTokenCount).toBeNull();
    expect(body.actualImageCount).toBe(2);
    expect(body.requestedImageCount).toBe(2);
    expect(body.attributes.resolution).toBe("1024x1024");
  });
});

describe("sendFalMetrics VIDEO tracking", () => {
  it("sends VIDEO payload with duration", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendFalMetrics({
      endpointId: "fal-ai/kling-video/v2/master/text-to-video",
      operationType: "VIDEO",
      startTime: Date.now() - 5000,
      duration: 5000,
      input: { prompt: "a running horse", duration: 10, aspect_ratio: "16:9" },
      result: { video: { url: "https://example.com/video.mp4" } },
      isStreamed: false,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operationType).toBe("VIDEO");
    expect(body.provider).toBe("fal_ai");
    expect(body.inputTokenCount).toBeNull();
    expect(body.durationSeconds).toBe(10);
    expect(body.attributes.video_duration_seconds).toBe(10);
    expect(body.attributes.aspect_ratio).toBe("16:9");
  });
});

describe("sendFalMetrics AUDIO tracking", () => {
  it("sends AUDIO payload for text-to-speech", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendFalMetrics({
      endpointId: "fal-ai/chatterbox/text-to-speech",
      operationType: "AUDIO",
      startTime: Date.now() - 1000,
      duration: 1000,
      input: { text: "Hello world from fal.ai" },
      result: { audio_url: "https://example.com/audio.mp3" },
      isStreamed: false,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operationType).toBe("AUDIO");
    expect(body.provider).toBe("fal_ai");
    expect(body.inputTokenCount).toBeNull();
    expect(body.characterCount).toBe(23);
    expect(body.attributes.operationSubtype).toBe("speech_synthesis");
  });

  it("sends AUDIO payload for TTS via prompt field (kokoro)", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendFalMetrics({
      endpointId: "fal-ai/kokoro/american-english",
      operationType: "AUDIO",
      startTime: Date.now() - 1500,
      duration: 1500,
      input: { prompt: "Hello from Revenium!", voice: "af_heart" },
      result: { audio: { url: "https://example.com/audio.wav" } },
      isStreamed: false,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operationType).toBe("AUDIO");
    expect(body.characterCount).toBe(20);
    expect(body.attributes.operationSubtype).toBe("speech_synthesis");
    expect(body.attributes.billing_unit).toBe("per_character");
  });

  it("sends AUDIO payload for audio generation (music/sfx)", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendFalMetrics({
      endpointId: "fal-ai/stable-audio/music-gen",
      operationType: "AUDIO",
      startTime: Date.now() - 2000,
      duration: 2000,
      input: { prompt: "epic orchestral soundtrack", duration: 30 },
      result: { audio_url: "https://example.com/music.mp3" },
      isStreamed: false,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operationType).toBe("AUDIO");
    expect(body.durationSeconds).toBe(30);
    expect(body.attributes.operationSubtype).toBe("audio_generation");
    expect(body.attributes.billing_unit).toBe("per_second");
    expect(body.characterCount).toBeUndefined();
  });

  it("sends AUDIO payload for transcription", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendFalMetrics({
      endpointId: "fal-ai/whisper",
      operationType: "AUDIO",
      startTime: Date.now() - 3000,
      duration: 3000,
      input: { audio_url: "https://example.com/input.mp3" },
      result: { text: "Transcribed text", duration: 45.5 },
      isStreamed: false,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operationType).toBe("AUDIO");
    expect(body.durationSeconds).toBe(45.5);
    expect(body.attributes.operationSubtype).toBe("transcription");
  });
});

describe("sendFalMetrics CHAT tracking", () => {
  it("sends CHAT payload with token counts", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendFalMetrics({
      endpointId: "openrouter/router",
      operationType: "CHAT",
      startTime: Date.now() - 800,
      duration: 800,
      input: { prompt: "What is AI?", model: "google/gemini-2.5-flash" },
      result: {
        output: "AI is...",
        usage: { prompt_tokens: 40, completion_tokens: 227, total_tokens: 267 },
      },
      isStreamed: false,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operationType).toBe("CHAT");
    expect(body.provider).toBe("fal_ai");
    expect(body.inputTokenCount).toBe(40);
    expect(body.outputTokenCount).toBe(227);
    expect(body.totalTokenCount).toBe(267);
  });
});

describe("sendFalMetrics common fields", () => {
  it("always includes required payload fields", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendFalMetrics({
      endpointId: "fal-ai/flux/dev",
      operationType: "IMAGE",
      startTime: Date.now() - 1000,
      duration: 1000,
      input: {},
      result: { images: [] },
      isStreamed: false,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.transactionId).toMatch(/^fal-/);
    expect(body.costType).toBe("AI");
    expect(body.stopReason).toBe("END");
    expect(body.isStreamed).toBe(false);
    expect(body.requestTime).toBeDefined();
    expect(body.responseTime).toBeDefined();
    expect(body.requestDuration).toBe(1000);
  });

  it("sets isStreamed true for streamed calls", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendFalMetrics({
      endpointId: "fal-ai/flux/dev",
      operationType: "IMAGE",
      startTime: Date.now() - 1000,
      duration: 1000,
      input: {},
      result: { images: [] },
      isStreamed: true,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.isStreamed).toBe(true);
  });
});
