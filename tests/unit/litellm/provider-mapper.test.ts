import {
  extractModelSource,
  extractProvider,
  extractModelName,
  isValidModelFormat,
} from "../../../src/litellm/provider-mapper";

describe("extractModelSource", () => {
  it("detects OpenAI models by pattern", () => {
    expect(extractModelSource("gpt-4")).toBe("OPENAI");
    expect(extractModelSource("gpt-3.5-turbo")).toBe("OPENAI");
    expect(extractModelSource("text-embedding-ada-002")).toBe("OPENAI");
  });

  it("detects Anthropic models by pattern", () => {
    expect(extractModelSource("claude-3-sonnet")).toBe("ANTHROPIC");
  });

  it("detects Google models by pattern", () => {
    expect(extractModelSource("gemini-pro")).toBe("GOOGLE");
  });

  it("detects provider by prefix", () => {
    expect(extractModelSource("openai/gpt-4")).toBe("OPENAI");
    expect(extractModelSource("anthropic/claude-3")).toBe("ANTHROPIC");
    expect(extractModelSource("vertex_ai/gemini-pro")).toBe("GOOGLE");
    expect(extractModelSource("azure/gpt-4")).toBe("AZURE");
    expect(extractModelSource("cohere/command-r")).toBe("COHERE");
    expect(extractModelSource("together_ai/llama-3")).toBe("TOGETHER");
    expect(extractModelSource("groq/llama2-70b")).toBe("GROQ");
    expect(extractModelSource("mistral/mistral-large")).toBe("MISTRAL");
    expect(extractModelSource("ollama/llama2")).toBe("OLLAMA");
  });

  it("falls back to LITELLM for unknown models", () => {
    expect(extractModelSource("custom-model-xyz")).toBe("LITELLM");
  });
});

describe("extractProvider", () => {
  it("returns display name by prefix", () => {
    expect(extractProvider("openai/gpt-4")).toBe("OpenAI");
    expect(extractProvider("anthropic/claude-3")).toBe("Anthropic");
    expect(extractProvider("vertex_ai/gemini-pro")).toBe("Google Vertex AI");
  });

  it("returns display name by pattern", () => {
    expect(extractProvider("gpt-4")).toBe("OpenAI");
    expect(extractProvider("claude-3-sonnet")).toBe("Anthropic");
  });

  it("returns prefix for totally unknown models", () => {
    expect(extractProvider("myprefix/mymodel")).toBe("myprefix");
  });

  it("returns Unknown for non-prefixed unknown models", () => {
    expect(extractProvider("custommodel")).toBe("Unknown");
  });
});

describe("extractModelName", () => {
  it("strips prefix from prefixed models", () => {
    expect(extractModelName("openai/gpt-4")).toBe("gpt-4");
    expect(extractModelName("anthropic/claude-3")).toBe("claude-3");
  });

  it("returns model as-is when no prefix", () => {
    expect(extractModelName("gpt-4")).toBe("gpt-4");
  });

  it("handles multiple slashes", () => {
    expect(extractModelName("vertex_ai/google/gemini-pro")).toBe("google/gemini-pro");
  });
});

describe("isValidModelFormat", () => {
  it("returns true for valid formats", () => {
    expect(isValidModelFormat("gpt-4")).toBe(true);
    expect(isValidModelFormat("openai/gpt-4")).toBe(true);
    expect(isValidModelFormat("claude-3.5-sonnet")).toBe(true);
  });

  it("returns false for empty or invalid", () => {
    expect(isValidModelFormat("")).toBe(false);
    expect(isValidModelFormat("  ")).toBe(false);
    expect(isValidModelFormat(null as unknown as string)).toBe(false);
    expect(isValidModelFormat(undefined as unknown as string)).toBe(false);
  });

  it("rejects models with special characters", () => {
    expect(isValidModelFormat("model name with spaces")).toBe(false);
    expect(isValidModelFormat("model@provider")).toBe(false);
  });
});
