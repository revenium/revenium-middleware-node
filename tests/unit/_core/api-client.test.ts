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

  it("sends POST with correct headers", async () => {
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

  it("throws on non-ok response", async () => {
    setConfig(createReveniumConfig());
    global.fetch = createMockFetch({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(sendToRevenium(createPayload())).rejects.toThrow("Revenium API error: 500");
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
});
