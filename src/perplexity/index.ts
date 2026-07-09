export type { ReveniumConfig, UsageMetadata, Logger, Config } from "../_core/types/index.js";

export {
  Initialize,
  GetClient,
  IsInitialized,
  Reset,
  Configure,
  ReveniumPerplexity,
} from "./client.js";

export type { PerplexityConfig } from "./client.js";

export {
  ChatInterface,
  CompletionsInterface,
  StreamingWrapper,
  trackUsageAsync,
} from "./middleware.js";

export type {
  PerplexityCost,
  PerplexityUsage,
  PerplexityChoice,
  PerplexityResponse,
  PerplexityChatRequest,
  PerplexityStreamChunk,
} from "./types.js";

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

export { flushMeteringBuffer, getBufferStats } from "../_core/metering/buffer.js";
export type { BufferStats } from "../_core/metering/buffer.js";
