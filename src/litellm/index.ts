import { getLogger } from "../_core/config/manager.js";
import {
  patchHttpClient,
  unpatchHttpClient,
  isHttpClientPatched,
  resetHttpClientManager,
  setLiteLLMConfig,
  getLiteLLMConfig,
} from "./http-client.js";
import type { LiteLLMConfig, MiddlewareStatus } from "./types.js";

let isInitialized = false;

function loadConfigFromEnv(): LiteLLMConfig | null {
  const reveniumMeteringApiKey = process.env.REVENIUM_METERING_API_KEY;
  const reveniumMeteringBaseUrl =
    process.env.REVENIUM_METERING_BASE_URL || "https://api.revenium.ai";
  const litellmProxyUrl = process.env.LITELLM_PROXY_URL;
  const litellmApiKey = process.env.LITELLM_API_KEY;
  const organizationName = process.env.REVENIUM_ORGANIZATION_NAME;
  const apiTimeout = process.env.REVENIUM_API_TIMEOUT
    ? parseInt(process.env.REVENIUM_API_TIMEOUT, 10)
    : undefined;
  const failSilent = process.env.REVENIUM_FAIL_SILENT !== "false";
  const maxRetries = process.env.REVENIUM_MAX_RETRIES
    ? parseInt(process.env.REVENIUM_MAX_RETRIES, 10)
    : undefined;

  let printSummary: boolean | "human" | "json" | undefined;
  const printSummaryEnv = process.env.REVENIUM_PRINT_SUMMARY;
  if (printSummaryEnv) {
    if (printSummaryEnv === "true") printSummary = true;
    else if (printSummaryEnv === "false") printSummary = false;
    else if (printSummaryEnv === "human" || printSummaryEnv === "json")
      printSummary = printSummaryEnv;
  }

  const teamId = process.env.REVENIUM_TEAM_ID;
  const capturePrompts = process.env.REVENIUM_CAPTURE_PROMPTS?.toLowerCase() === "true";

  if (!reveniumMeteringApiKey || !litellmProxyUrl) return null;

  return {
    reveniumMeteringApiKey,
    reveniumMeteringBaseUrl,
    litellmProxyUrl,
    litellmApiKey,
    organizationName,
    apiTimeout,
    failSilent,
    maxRetries,
    printSummary,
    teamId,
    capturePrompts,
  };
}

export function initialize(): boolean {
  const logger = getLogger();
  if (isInitialized) return true;

  const config = loadConfigFromEnv();
  if (!config) {
    logger.warn(
      "Revenium LiteLLM middleware not initialized - missing configuration. " +
        "Required: REVENIUM_METERING_API_KEY, LITELLM_PROXY_URL",
    );
    return false;
  }

  setLiteLLMConfig(config);
  const patchSuccess = patchHttpClient();

  if (!patchSuccess) {
    logger.error("Failed to patch HTTP client - middleware disabled");
    return false;
  }

  isInitialized = true;
  logger.info("Revenium LiteLLM middleware initialized successfully");
  return true;
}

export function configure(config: LiteLLMConfig): boolean {
  const logger = getLogger();
  try {
    setLiteLLMConfig(config);

    if (!isHttpClientPatched()) {
      const patchSuccess = patchHttpClient();
      if (patchSuccess) {
        isInitialized = true;
      }
      return patchSuccess;
    }

    return true;
  } catch (error) {
    logger.error("Failed to set Revenium LiteLLM configuration", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export function isMiddlewareInitialized(): boolean {
  return isInitialized && isHttpClientPatched();
}

export function getStatus(): MiddlewareStatus {
  const config = getLiteLLMConfig();
  return {
    initialized: isInitialized,
    patched: isHttpClientPatched(),
    hasConfig: !!config,
    proxyUrl: config?.litellmProxyUrl,
  };
}

export function enable(): boolean {
  const logger = getLogger();
  const config = getLiteLLMConfig();
  if (!config) {
    logger.error("Cannot enable middleware without configuration");
    return false;
  }

  const success = patchHttpClient();
  if (success) isInitialized = true;
  return success;
}

export function disable(): boolean {
  const success = unpatchHttpClient();
  if (success) isInitialized = false;
  return success;
}

export function reset(): void {
  isInitialized = false;
  resetHttpClientManager();
}

export type {
  LiteLLMConfig,
  LiteLLMUsageMetadata,
  MiddlewareStatus,
  LiteLLMChatCompletionRequest,
  LiteLLMChatCompletionResponse,
  LiteLLMEmbeddingRequest,
  LiteLLMEmbeddingResponse,
  ProviderPattern,
  ChatMessage,
  MessageRole,
  TokenUsage,
  ResponseChoice,
  ResponseMessage,
} from "./types.js";

export {
  extractModelSource,
  extractProvider,
  extractModelName,
  isValidModelFormat,
  PROVIDER_REGISTRY,
} from "./provider-mapper.js";

export { trackUsageAsync, trackEmbeddingsUsageAsync } from "./tracking.js";

export {
  patchHttpClient,
  unpatchHttpClient,
  isHttpClientPatched,
  resetHttpClientManager,
} from "./http-client.js";

export type {
  ToolContext,
  ToolMetadata,
  ToolEventPayload,
  ToolCallReport,
} from "../_core/types/tool-metering.js";

export {
  meterTool,
  reportToolCall,
  setToolContext,
  getToolContext,
  clearToolContext,
  runWithToolContext,
} from "../_core/tool-metering/index.js";
