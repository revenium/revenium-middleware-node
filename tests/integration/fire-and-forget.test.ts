import { createReveniumConfig } from "../helpers/fixtures";

let trackUsageAsync: typeof import("../../src/openai/middleware").trackUsageAsync;
let setConfig: typeof import("../../src/_core/config/manager").setConfig;
let resetConfig: typeof import("../../src/_core/config/manager").resetConfig;

beforeEach(async () => {
  jest.resetModules();
  const manager = await import("../../src/_core/config/manager");
  setConfig = manager.setConfig;
  resetConfig = manager.resetConfig;
  setConfig(createReveniumConfig());
  const mw = await import("../../src/openai/middleware");
  trackUsageAsync = mw.trackUsageAsync;
});

afterEach(() => {
  resetConfig();
  jest.restoreAllMocks();
});

describe("fire-and-forget tracking", () => {
  it("trackUsageAsync returns before sendToRevenium resolves", async () => {
    let meteringResolved = false;

    const delayedFetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          setTimeout(() => {
            meteringResolved = true;
            resolve({
              ok: true,
              status: 200,
              statusText: "OK",
              json: () => Promise.resolve({}),
              text: () => Promise.resolve(""),
            } as unknown as Response);
          }, 100);
        }),
    );

    global.fetch = delayedFetch;

    trackUsageAsync({
      requestId: "req-1",
      model: "gpt-4",
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      duration: 500,
      finishReason: "stop",
    });

    expect(meteringResolved).toBe(false);

    await new Promise((r) => setTimeout(r, 200));

    expect(meteringResolved).toBe(true);
  });
});
