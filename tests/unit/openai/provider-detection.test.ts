import {
  Provider,
  detectProviderFromConfig,
  getProviderMetadata,
  hasAzureConfig,
  validateAzureConfig,
} from "../../../src/openai/provider-detection";

const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("detectProviderFromConfig", () => {
  it("detects OpenAI when no Azure config", () => {
    const result = detectProviderFromConfig({});
    expect(result.provider).toBe(Provider.OPENAI);
    expect(result.isAzure).toBe(false);
  });

  it("detects Azure when both apiKey and endpoint provided", () => {
    const result = detectProviderFromConfig({
      azure: {
        apiKey: "azure-key",
        endpoint: "https://my-resource.openai.azure.com",
      },
    });
    expect(result.provider).toBe(Provider.AZURE_OPENAI);
    expect(result.isAzure).toBe(true);
    expect(result.azureConfig).toBeDefined();
  });

  it("falls back to OpenAI when Azure config incomplete", () => {
    const result = detectProviderFromConfig({
      azure: { apiKey: "key-only" } as any,
    });
    expect(result.provider).toBe(Provider.OPENAI);
  });
});

describe("getProviderMetadata", () => {
  it("returns Azure metadata when isAzure", () => {
    const meta = getProviderMetadata({
      provider: Provider.AZURE_OPENAI,
      isAzure: true,
    });
    expect(meta.provider).toBe("Azure");
    expect(meta.modelSource).toBe("AZURE_OPENAI");
  });

  it("returns OpenAI metadata when not Azure", () => {
    const meta = getProviderMetadata({
      provider: Provider.OPENAI,
      isAzure: false,
    });
    expect(meta.provider).toBe("OpenAI");
    expect(meta.modelSource).toBe("OPENAI");
  });
});

describe("hasAzureConfig", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns false when no Azure env vars", () => {
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_API_KEY;
    expect(hasAzureConfig()).toBe(false);
  });

  it("returns true when AZURE_OPENAI_ENDPOINT set", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://my.azure.com";
    expect(hasAzureConfig()).toBe(true);
  });
});

describe("validateAzureConfig", () => {
  it("valid when endpoint and apiKey present", () => {
    const result = validateAzureConfig({
      endpoint: "https://my.openai.azure.com",
      apiKey: "my-key",
    });
    expect(result.isValid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  it("invalid when endpoint missing", () => {
    const result = validateAzureConfig({
      apiKey: "my-key",
    } as any);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain("endpoint");
  });

  it("warns when no apiVersion", () => {
    const result = validateAzureConfig({
      endpoint: "https://my.openai.azure.com",
      apiKey: "my-key",
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("warns when endpoint does not contain azure", () => {
    const result = validateAzureConfig({
      endpoint: "https://custom.example.com",
      apiKey: "my-key",
    });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("azure")]));
  });
});
