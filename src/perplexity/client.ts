import OpenAI from "openai";
import { Config } from "../_core/types/index.js";
import { getConfig, setConfig, initializeConfig } from "../_core/config/manager.js";
import { validateConfig } from "../_core/config/validator.js";
import { DEFAULT_REVENIUM_BASE_URL } from "../_core/constants.js";
import { ChatInterface } from "./middleware.js";

const DEFAULT_PERPLEXITY_BASE_URL = "https://api.perplexity.ai";

export interface PerplexityConfig extends Config {
  perplexityApiKey?: string;
  perplexityBaseUrl?: string;
}

export class ReveniumPerplexity {
  private client: OpenAI;
  private config: PerplexityConfig;

  constructor(config: PerplexityConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.perplexityApiKey,
      baseURL: config.perplexityBaseUrl || DEFAULT_PERPLEXITY_BASE_URL,
    });
  }

  chat(): ChatInterface {
    return new ChatInterface(this.client);
  }

  getUnderlyingClient(): OpenAI {
    return this.client;
  }

  getConfig(): PerplexityConfig {
    return this.config;
  }
}

let globalClient: ReveniumPerplexity | null = null;

export function Initialize(config?: Partial<PerplexityConfig>): void {
  let finalConfig: PerplexityConfig;

  if (config) {
    finalConfig = {
      reveniumBaseUrl: DEFAULT_REVENIUM_BASE_URL,
      perplexityBaseUrl: DEFAULT_PERPLEXITY_BASE_URL,
      debug: false,
      ...config,
    } as PerplexityConfig;
  } else {
    const envLoaded = initializeConfig();
    if (!envLoaded) {
      throw new Error(
        "Failed to load configuration from environment variables. " +
          "Ensure REVENIUM_METERING_API_KEY and PERPLEXITY_API_KEY are set.",
      );
    }
    finalConfig = getConfig()! as PerplexityConfig;
    finalConfig.perplexityApiKey = finalConfig.perplexityApiKey || process.env.PERPLEXITY_API_KEY;
    finalConfig.perplexityBaseUrl =
      finalConfig.perplexityBaseUrl ||
      process.env.PERPLEXITY_API_BASE_URL ||
      DEFAULT_PERPLEXITY_BASE_URL;
  }

  if (!finalConfig.perplexityApiKey) {
    throw new Error(
      "perplexityApiKey is required. Set PERPLEXITY_API_KEY environment variable or pass it in config.",
    );
  }

  validateConfig(finalConfig);
  setConfig(finalConfig);

  globalClient = new ReveniumPerplexity(finalConfig);
}

export function GetClient(): ReveniumPerplexity {
  if (!globalClient) {
    throw new Error(
      "Revenium Perplexity client not initialized. Call Initialize() first.\n\n" +
        "Example:\n" +
        '  import { Initialize, GetClient } from "revenium-middleware-node-internal/perplexity";\n' +
        "  Initialize();\n" +
        "  const client = GetClient();",
    );
  }
  return globalClient;
}

export function IsInitialized(): boolean {
  return globalClient !== null;
}

export function Reset(): void {
  globalClient = null;
}

export function Configure(config: Partial<PerplexityConfig>): void {
  Initialize(config);
}
