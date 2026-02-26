import { createReveniumConfig, createMockFetch } from "../../helpers/fixtures";

let meterTool: typeof import("../../../src/_core/tool-metering/tool-tracker").meterTool;
let reportToolCall: typeof import("../../../src/_core/tool-metering/tool-tracker").reportToolCall;
let setConfig: typeof import("../../../src/_core/config/manager").setConfig;
let resetConfig: typeof import("../../../src/_core/config/manager").resetConfig;

beforeEach(async () => {
  jest.resetModules();
  const manager = await import("../../../src/_core/config/manager");
  const tracker = await import("../../../src/_core/tool-metering/tool-tracker");
  meterTool = tracker.meterTool;
  reportToolCall = tracker.reportToolCall;
  setConfig = manager.setConfig;
  resetConfig = manager.resetConfig;

  setConfig(createReveniumConfig());
  global.fetch = createMockFetch();
});

afterEach(() => {
  resetConfig();
  jest.restoreAllMocks();
});

describe("meterTool", () => {
  it("returns result of sync function", async () => {
    const result = await meterTool("my-tool", () => 42);
    expect(result).toBe(42);
  });

  it("returns result of async function", async () => {
    const result = await meterTool("my-tool", async () => "async-result");
    expect(result).toBe("async-result");
  });

  it("propagates errors from sync function", () => {
    expect(() =>
      meterTool("my-tool", () => {
        throw new Error("sync-fail");
      }),
    ).toThrow("sync-fail");
  });

  it("propagates errors from async function", async () => {
    await expect(
      meterTool("my-tool", async () => {
        throw new Error("async-fail");
      }),
    ).rejects.toThrow("async-fail");
  });

  it("dispatches event after success (fire-and-forget)", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await meterTool("tool-x", () => "done");
    await new Promise((r) => setTimeout(r, 10));

    expect(mockFetch).toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.toolId).toBe("tool-x");
    expect(body.success).toBe(true);
  });

  it("dispatches event after failure (fire-and-forget)", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    try {
      meterTool("tool-x", () => {
        throw new Error("oops");
      });
    } catch {}
    await new Promise((r) => setTimeout(r, 10));

    expect(mockFetch).toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.success).toBe(false);
    expect(body.errorMessage).toBe("oops");
  });

  it("captures error message on failure", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    await meterTool("tool-x", async () => {
      throw new Error("specific error");
    }).catch(() => {});
    await new Promise((r) => setTimeout(r, 10));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.errorMessage).toBe("specific error");
  });
});

describe("reportToolCall", () => {
  it("dispatches tool event", async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    reportToolCall("manual-tool", {
      success: true,
      durationMs: 250,
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(mockFetch).toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.toolId).toBe("manual-tool");
    expect(body.durationMs).toBe(250);
    expect(body.success).toBe(true);
  });
});
