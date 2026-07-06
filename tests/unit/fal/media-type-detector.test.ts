import {
  detectFromEndpointId,
  correctFromResponse,
  detectMediaType,
} from "../../../src/fal/media-type-detector";

beforeEach(() => {
  jest.resetModules();
});

describe("detectFromEndpointId", () => {
  it.each([
    ["fal-ai/flux/dev", "IMAGE"],
    ["fal-ai/flux-pro/v1.1-ultra", "IMAGE"],
    ["fal-ai/stable-diffusion-v35-large", "IMAGE"],
    ["fal-ai/recraft/v4/pro/text-to-image", "IMAGE"],
    ["fal-ai/bria/background/remove", "IMAGE"],
    ["fal-ai/nano-banana-2", "IMAGE"],
    ["fal-ai/sdxl", "IMAGE"],
    ["fal-ai/omnigen-v1", "IMAGE"],
    ["fal-ai/controlnet-sdxl", "IMAGE"],
    ["fal-ai/ip-adapter-face-id", "IMAGE"],
    ["fal-ai/topaz/upscale/image", "IMAGE"],
    ["fal-ai/cat-vton", "IMAGE"],
  ])("detects %s as %s", (endpointId, expected) => {
    expect(detectFromEndpointId(endpointId)).toBe(expected);
  });

  it.each([
    ["fal-ai/kling-video/v3/pro/image-to-video", "VIDEO"],
    ["fal-ai/veo3.1", "VIDEO"],
    ["fal-ai/sora-2/text-to-video", "VIDEO"],
    ["fal-ai/ltx-2-19b/image-to-video", "VIDEO"],
    ["fal-ai/minimax-video/director", "VIDEO"],
    ["fal-ai/runway/gen3/turbo", "VIDEO"],
    ["fal-ai/luma-dream-machine", "VIDEO"],
    ["fal-ai/haiper-video-2", "VIDEO"],
    ["fal-ai/cogvideo-5b", "VIDEO"],
    ["fal-ai/animate-anything", "VIDEO"],
  ])("detects %s as %s", (endpointId, expected) => {
    expect(detectFromEndpointId(endpointId)).toBe(expected);
  });

  it.each([
    ["fal-ai/chatterbox/text-to-speech", "AUDIO"],
    ["fal-ai/minimax/speech-02-hd", "AUDIO"],
    ["fal-ai/whisper", "AUDIO"],
    ["fal-ai/f5-tts", "AUDIO"],
    ["fal-ai/kokoro/american-english", "AUDIO"],
    ["fal-ai/dia/v1/voice-clone", "AUDIO"],
    ["mirelo-ai/sfx-v1/video-to-audio", "AUDIO"],
    ["fal-ai/lava-sr", "AUDIO"],
    ["fal-ai/parler-tts", "AUDIO"],
  ])("detects %s as %s", (endpointId, expected) => {
    expect(detectFromEndpointId(endpointId)).toBe(expected);
  });

  it.each([
    ["openrouter/router", "CHAT"],
    ["openrouter/google/gemini-2.5-flash", "CHAT"],
  ])("detects %s as %s", (endpointId, expected) => {
    expect(detectFromEndpointId(endpointId)).toBe(expected);
  });

  it("defaults to IMAGE for unknown endpoints", () => {
    expect(detectFromEndpointId("fal-ai/unknown-model-xyz")).toBe("IMAGE");
  });
});

describe("correctFromResponse", () => {
  it("corrects to VIDEO when response has video field", () => {
    expect(correctFromResponse("IMAGE", { video: { url: "https://example.com/v.mp4" } })).toBe(
      "VIDEO",
    );
  });

  it("corrects to VIDEO when file_url ends with .mp4", () => {
    expect(correctFromResponse("IMAGE", { file_url: "https://example.com/output.mp4" })).toBe(
      "VIDEO",
    );
  });

  it("corrects to AUDIO when response has audio_url", () => {
    expect(correctFromResponse("IMAGE", { audio_url: "https://example.com/a.mp3" })).toBe("AUDIO");
  });

  it("corrects to AUDIO when response has audio field", () => {
    expect(correctFromResponse("IMAGE", { audio: { url: "https://example.com/a.wav" } })).toBe(
      "AUDIO",
    );
  });

  it("corrects to AUDIO when file_url ends with .mp3", () => {
    expect(correctFromResponse("VIDEO", { file_url: "https://example.com/out.mp3" })).toBe("AUDIO");
  });

  it("corrects to VIDEO when file_url has .mp4 with query string", () => {
    expect(
      correctFromResponse("IMAGE", {
        file_url: "https://cdn.fal.ai/output.mp4?token=abc123&expires=999",
      }),
    ).toBe("VIDEO");
  });

  it("corrects to AUDIO when file_url has .wav with query string", () => {
    expect(
      correctFromResponse("IMAGE", {
        file_url: "https://cdn.fal.ai/speech.wav?X-Amz-Signature=abc",
      }),
    ).toBe("AUDIO");
  });

  it("corrects to IMAGE when response has images array", () => {
    expect(correctFromResponse("CHAT", { images: [{ url: "https://example.com/i.png" }] })).toBe(
      "IMAGE",
    );
  });

  it("corrects to CHAT when response has usage object", () => {
    expect(
      correctFromResponse("IMAGE", { usage: { prompt_tokens: 10, completion_tokens: 20 } }),
    ).toBe("CHAT");
  });

  it("keeps initial type when response is null", () => {
    expect(correctFromResponse("VIDEO", null)).toBe("VIDEO");
  });

  it("keeps initial type when response has no recognizable fields", () => {
    expect(correctFromResponse("IMAGE", { seed: 12345, timings: {} })).toBe("IMAGE");
  });
});

describe("detectMediaType", () => {
  it("uses endpoint ID when no response provided", () => {
    expect(detectMediaType("fal-ai/flux/dev")).toBe("IMAGE");
  });

  it("corrects type based on response", () => {
    expect(detectMediaType("fal-ai/unknown-model", { video: { url: "test.mp4" } })).toBe("VIDEO");
  });

  it("combines endpoint detection with response correction", () => {
    expect(detectMediaType("fal-ai/flux/dev", { images: [{ url: "test.png" }] })).toBe("IMAGE");
  });
});
