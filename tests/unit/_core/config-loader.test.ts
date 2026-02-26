import { loadConfigFromEnv, resetEnvFilesLoaded } from "../../../src/_core/config/loader";
import { ENV_VARS, DEFAULT_REVENIUM_BASE_URL } from "../../../src/_core/constants";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  resetEnvFilesLoaded();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("loadConfigFromEnv", () => {
  it("returns null when no API key is set", () => {
    delete process.env[ENV_VARS.REVENIUM_API_KEY];
    delete process.env[ENV_VARS.REVENIUM_API_KEY_ALT];
    expect(loadConfigFromEnv()).toBeNull();
  });

  it("loads config from primary env var", () => {
    process.env[ENV_VARS.REVENIUM_API_KEY] = "hak_tenant_abc";
    const config = loadConfigFromEnv();
    expect(config).not.toBeNull();
    expect(config!.reveniumApiKey).toBe("hak_tenant_abc");
  });

  it("falls back to alt env var", () => {
    delete process.env[ENV_VARS.REVENIUM_API_KEY];
    process.env[ENV_VARS.REVENIUM_API_KEY_ALT] = "hak_alt_key123";
    const config = loadConfigFromEnv();
    expect(config!.reveniumApiKey).toBe("hak_alt_key123");
  });

  it("uses default base URL when not specified", () => {
    process.env[ENV_VARS.REVENIUM_API_KEY] = "hak_tenant_abc";
    const config = loadConfigFromEnv();
    expect(config!.reveniumBaseUrl).toBe(DEFAULT_REVENIUM_BASE_URL);
  });

  it("reads custom base URL", () => {
    process.env[ENV_VARS.REVENIUM_API_KEY] = "hak_tenant_abc";
    process.env[ENV_VARS.REVENIUM_BASE_URL] = "https://custom.api";
    const config = loadConfigFromEnv();
    expect(config!.reveniumBaseUrl).toBe("https://custom.api");
  });

  it("parses printSummary=json", () => {
    process.env[ENV_VARS.REVENIUM_API_KEY] = "hak_tenant_abc";
    process.env[ENV_VARS.PRINT_SUMMARY] = "json";
    const config = loadConfigFromEnv();
    expect(config!.printSummary).toBe("json");
  });

  it("parses printSummary=true as human", () => {
    process.env[ENV_VARS.REVENIUM_API_KEY] = "hak_tenant_abc";
    process.env[ENV_VARS.PRINT_SUMMARY] = "true";
    const config = loadConfigFromEnv();
    expect(config!.printSummary).toBe("human");
  });

  it("reads teamId", () => {
    process.env[ENV_VARS.REVENIUM_API_KEY] = "hak_tenant_abc";
    process.env[ENV_VARS.TEAM_ID] = "team-42";
    const config = loadConfigFromEnv();
    expect(config!.teamId).toBe("team-42");
  });

  it("parses capturePrompts", () => {
    process.env[ENV_VARS.REVENIUM_API_KEY] = "hak_tenant_abc";
    process.env[ENV_VARS.CAPTURE_PROMPTS] = "true";
    const config = loadConfigFromEnv();
    expect(config!.capturePrompts).toBe(true);
  });
});
