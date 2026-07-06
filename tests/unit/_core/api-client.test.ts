import { createReveniumConfig, createPayload, createMockFetch } from "../../helpers/fixtures";

let sendToRevenium: typeof import("../../../src/_core/metering/api-client").sendToRevenium;
let setConfig: typeof import("../../../src/_core/config/manager").setConfig;
let resetConfig: typeof import("../../../src/_core/config/manager").resetConfig;

beforeEach(async () => {
  jest.resetModules();
  const manager = await import("../../../src/_core/config/manager");
  const client = await import("../../../src/_core/metering/api-client");
  sendToRevenium = client.sendToRevenium;
  setConfig = manager.setConfig;
  resetConfig = manager.resetConfig;
});

afterEach(() => {
  resetConfig();
  jest.restoreAllMocks();
});

describe("sendToRevenium", () => {
  it("skips when config is null", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;
    await sendToRevenium(createPayload());
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends POST with correct headers including Idempotency-Key", async () => {
    const config = createReveniumConfig();
    setConfig(config);
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendToRevenium(createPayload());

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/meter/v2/ai/completions");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["x-api-key"]).toBe(config.reveniumApiKey);
    expect(options.headers["Idempotency-Key"]).toBeDefined();
    expect(options.headers["Idempotency-Key"].length).toBeGreaterThan(0);
  });

  it("routes IMAGE payloads to /ai/images", async () => {
    setConfig(createReveniumConfig());
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendToRevenium(createPayload({ operationType: "IMAGE" }));

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/ai/images");
  });

  it("routes AUDIO payloads to /ai/audio", async () => {
    setConfig(createReveniumConfig());
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendToRevenium(createPayload({ operationType: "AUDIO" }));

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/ai/audio");
  });

  it("throws on terminal HTTP error without retry", async () => {
    setConfig(createReveniumConfig());
    global.fetch = createMockFetch({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    await expect(sendToRevenium(createPayload())).rejects.toThrow("Revenium API error: 401");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("serializes payload as JSON body", async () => {
    setConfig(createReveniumConfig());
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;
    const payload = createPayload({ model: "test-model-123" });

    await sendToRevenium(payload);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe("test-model-123");
  });

  it("generates unique Idempotency-Key per call", async () => {
    setConfig(createReveniumConfig());
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendToRevenium(createPayload());
    await sendToRevenium(createPayload());

    const key1 = mockFetch.mock.calls[0][1].headers["Idempotency-Key"];
    const key2 = mockFetch.mock.calls[1][1].headers["Idempotency-Key"];
    expect(key1).not.toBe(key2);
  });

  it("uses override idempotencyKey from payload when provided", async () => {
    setConfig(createReveniumConfig());
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendToRevenium(createPayload({ idempotencyKey: "custom-key-123" }));

    const key = mockFetch.mock.calls[0][1].headers["Idempotency-Key"];
    expect(key).toBe("custom-key-123");
  });

  it("excludes idempotencyKey from JSON body", async () => {
    setConfig(createReveniumConfig());
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await sendToRevenium(createPayload({ idempotencyKey: "custom-key-123" }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.idempotencyKey).toBeUndefined();
  });

  it("retries on 429 and reuses same Idempotency-Key", async () => {
    jest.useFakeTimers();
    setConfig(createReveniumConfig());
    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          text: () => Promise.resolve("rate limited"),
          headers: { get: (name: string) => (name === "Retry-After" ? "1" : null) },
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 201,
        statusText: "Created",
        headers: { get: () => null },
      } as unknown as Response);
    });

    const promise = sendToRevenium(createPayload());

    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
    }

    await promise;
    expect(callCount).toBe(2);

    const key1 = (global.fetch as jest.Mock).mock.calls[0][1].headers["Idempotency-Key"];
    const key2 = (global.fetch as jest.Mock).mock.calls[1][1].headers["Idempotency-Key"];
    expect(key1).toBe(key2);
    jest.useRealTimers();
  });

  it("retries on 503 and reuses same Idempotency-Key", async () => {
    jest.useFakeTimers();
    setConfig(createReveniumConfig());
    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          text: () => Promise.resolve(""),
          headers: { get: () => null },
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 201,
        statusText: "Created",
        headers: { get: () => null },
      } as unknown as Response);
    });

    const promise = sendToRevenium(createPayload());

    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
    }

    await promise;
    expect(callCount).toBe(2);

    const key1 = (global.fetch as jest.Mock).mock.calls[0][1].headers["Idempotency-Key"];
    const key2 = (global.fetch as jest.Mock).mock.calls[1][1].headers["Idempotency-Key"];
    expect(key1).toBe(key2);
    jest.useRealTimers();
  });
});
