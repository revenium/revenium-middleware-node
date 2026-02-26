describe("config isolation between providers", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("openai config does not leak into fresh module load", async () => {
    const m1 = await import("../../src/_core/config/manager");
    m1.setConfig({
      reveniumApiKey: "hak_openai_config123",
      reveniumBaseUrl: "https://api.revenium.ai",
    });
    expect(m1.getConfig()!.reveniumApiKey).toBe("hak_openai_config123");

    jest.resetModules();

    const m2 = await import("../../src/_core/config/manager");
    expect(m2.getConfig()).toBeNull();
  });

  it("separate provider loads get independent singletons", async () => {
    const m1 = await import("../../src/_core/config/manager");
    m1.setConfig({
      reveniumApiKey: "hak_provider_aaa111",
      reveniumBaseUrl: "https://api.revenium.ai",
    });

    jest.resetModules();

    const m2 = await import("../../src/_core/config/manager");
    m2.setConfig({
      reveniumApiKey: "hak_provider_bbb222",
      reveniumBaseUrl: "https://api.revenium.ai",
    });

    expect(m2.getConfig()!.reveniumApiKey).toBe("hak_provider_bbb222");

    jest.resetModules();

    const m3 = await import("../../src/_core/config/manager");
    expect(m3.getConfig()).toBeNull();
  });
});
