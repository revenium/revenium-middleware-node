import { createReveniumConfig } from "../../helpers/fixtures";

describe("config manager singleton", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  async function loadManager() {
    return import("../../../src/_core/config/manager");
  }

  it("starts with null config", async () => {
    const { getConfig } = await loadManager();
    expect(getConfig()).toBeNull();
  });

  it("setConfig stores and validates config", async () => {
    const { setConfig, getConfig } = await loadManager();
    const config = createReveniumConfig();
    setConfig(config);
    expect(getConfig()).toEqual(config);
  });

  it("setConfig throws on invalid config", async () => {
    const { setConfig } = await loadManager();
    expect(() => setConfig(createReveniumConfig({ reveniumApiKey: "" }))).toThrow();
  });

  it("resetConfig clears to null", async () => {
    const { setConfig, resetConfig, getConfig } = await loadManager();
    setConfig(createReveniumConfig());
    resetConfig();
    expect(getConfig()).toBeNull();
  });

  it("initializeConfig returns false when no env key", async () => {
    const ORIGINAL_ENV = process.env;
    process.env = { ...ORIGINAL_ENV };
    delete process.env.REVENIUM_METERING_API_KEY;
    delete process.env.REVENIUM_API_KEY;

    const { initializeConfig } = await loadManager();
    expect(initializeConfig()).toBe(false);

    process.env = ORIGINAL_ENV;
  });

  it("setLogger/getLogger work", async () => {
    const { setLogger, getLogger } = await loadManager();
    const custom = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    setLogger(custom);
    expect(getLogger()).toBe(custom);
  });

  it("modules are isolated between resets", async () => {
    const m1 = await loadManager();
    m1.setConfig(createReveniumConfig());
    expect(m1.getConfig()).not.toBeNull();

    jest.resetModules();
    const m2 = await loadManager();
    expect(m2.getConfig()).toBeNull();
  });
});
