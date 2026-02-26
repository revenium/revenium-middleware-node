import { validateConfig } from "../../../src/_core/config/validator";
import { createReveniumConfig } from "../../helpers/fixtures";

describe("validateConfig", () => {
  it("accepts a valid config", () => {
    expect(() => validateConfig(createReveniumConfig())).not.toThrow();
  });

  it("throws when API key is missing", () => {
    expect(() => validateConfig(createReveniumConfig({ reveniumApiKey: "" }))).toThrow(
      "Revenium API key is required",
    );
  });

  it("throws when API key lacks hak_ prefix", () => {
    expect(() => validateConfig(createReveniumConfig({ reveniumApiKey: "invalid_key" }))).toThrow(
      'should start with "hak_"',
    );
  });

  it("throws when base URL is missing", () => {
    expect(() => validateConfig(createReveniumConfig({ reveniumBaseUrl: "" }))).toThrow(
      "base URL is missing",
    );
  });

  it("throws when base URL is malformed", () => {
    expect(() => validateConfig(createReveniumConfig({ reveniumBaseUrl: "not-a-url" }))).toThrow(
      "Invalid Revenium base URL format",
    );
  });

  it("accepts various valid URL formats", () => {
    const urls = [
      "https://api.revenium.ai",
      "http://localhost:3000",
      "https://custom-host.com/path",
    ];
    for (const url of urls) {
      expect(() => validateConfig(createReveniumConfig({ reveniumBaseUrl: url }))).not.toThrow();
    }
  });
});
