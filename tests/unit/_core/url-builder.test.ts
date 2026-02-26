import { buildReveniumUrl, isValidUrl } from "../../../src/_core/metering/url-builder";

describe("buildReveniumUrl", () => {
  const endpoint = "/ai/completions";

  it("appends /meter/v2 when base has no metering path", () => {
    expect(buildReveniumUrl("https://api.revenium.ai", endpoint)).toBe(
      "https://api.revenium.ai/meter/v2/ai/completions",
    );
  });

  it("strips trailing slashes from base", () => {
    expect(buildReveniumUrl("https://api.revenium.ai///", endpoint)).toBe(
      "https://api.revenium.ai/meter/v2/ai/completions",
    );
  });

  it("skips /meter/v2 when base already ends with /meter/v2", () => {
    expect(buildReveniumUrl("https://api.revenium.ai/meter/v2", endpoint)).toBe(
      "https://api.revenium.ai/meter/v2/ai/completions",
    );
  });

  it("appends /v2 when base ends with /meter", () => {
    expect(buildReveniumUrl("https://api.revenium.ai/meter", endpoint)).toBe(
      "https://api.revenium.ai/meter/v2/ai/completions",
    );
  });

  it("handles base ending with /v2", () => {
    expect(buildReveniumUrl("https://custom.host/v2", endpoint)).toBe(
      "https://custom.host/v2/ai/completions",
    );
  });

  it("works with different endpoints", () => {
    expect(buildReveniumUrl("https://api.revenium.ai", "/ai/images")).toBe(
      "https://api.revenium.ai/meter/v2/ai/images",
    );
    expect(buildReveniumUrl("https://api.revenium.ai", "/ai/audio")).toBe(
      "https://api.revenium.ai/meter/v2/ai/audio",
    );
    expect(buildReveniumUrl("https://api.revenium.ai", "/tool/events")).toBe(
      "https://api.revenium.ai/meter/v2/tool/events",
    );
  });
});

describe("isValidUrl", () => {
  it("returns true for valid URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://localhost:3000")).toBe(true);
  });

  it("returns false for invalid URLs", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});
