import { UsageMetadata, ReveniumPayload } from "../_core/types/index.js";
import { getConfig, getLogger } from "../_core/config/manager.js";
import { sendToRevenium } from "../_core/metering/api-client.js";
import { buildPayload } from "../_core/metering/payload-builder.js";
import { mapStopReason } from "../_core/stop-reason-mapper.js";
import { printUsageSummary } from "../_core/prompt/summary-printer.js";
import {
  shouldCapturePrompts,
  getMaxPromptSize,
  truncateString,
} from "../_core/prompt/extraction.js";
import {
  CircuitBreaker,
  DEFAULT_CIRCUIT_CONFIG,
  FailureStrategy,
} from "../_core/resilience/circuit-breaker.js";
import { withRetry } from "../_core/resilience/retry.js";
import { DEFAULT_CONFIG } from "../_core/constants.js";

const MIDDLEWARE_SOURCE = "revenium-anthropic-node";

const anthropicFailureStrategy: FailureStrategy = {
  isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("overloaded") || msg.includes("rate_limit")) return true;
      if (msg.includes("timeout") || msg.includes("abort")) return true;
      const statusMatch = msg.match(/(\d{3})/);
      if (statusMatch) {
        const status = parseInt(statusMatch[1], 10);
        return status === 429 || status >= 500;
      }
    }
    return true;
  },
  isProviderThrottling(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return msg.includes("rate_limit") || msg.includes("429");
    }
    return false;
  },
};

let anthropicCircuitBreaker: CircuitBreaker | null = null;

function getAnthropicCircuitBreaker(): CircuitBreaker {
  if (!anthropicCircuitBreaker) {
    anthropicCircuitBreaker = new CircuitBreaker(DEFAULT_CIRCUIT_CONFIG, anthropicFailureStrategy);
  }
  return anthropicCircuitBreaker;
}

export function getCircuitBreakerStats() {
  return getAnthropicCircuitBreaker().getStats();
}

export function resetAnthropicCircuitBreaker(): void {
  if (anthropicCircuitBreaker) {
    anthropicCircuitBreaker.reset();
  }
  anthropicCircuitBreaker = null;
}

export function canExecuteRequest(): boolean {
  return getAnthropicCircuitBreaker().canExecute();
}

export interface AnthropicTrackingData {
  requestId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  duration: number;
  isStreamed: boolean;
  stopReason?: string;
  metadata?: UsageMetadata;
  requestTime: Date;
  responseTime: Date;
  timeToFirstToken?: number;
  hasVisionContent?: boolean;
  requestBody?: any;
  response?: any;
}

export function detectVisionContent(params?: any): boolean {
  if (!params) return false;
  try {
    if (params.messages && Array.isArray(params.messages)) {
      for (const message of params.messages) {
        if (!message?.content || !Array.isArray(message.content)) continue;
        for (const block of message.content) {
          if (block?.type === "image") return true;
        }
      }
    }
    if (params.system && Array.isArray(params.system)) {
      for (const block of params.system) {
        if (block?.type === "image") return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function extractSystemPrompt(params: any): string {
  if (!params.system) return "";
  if (typeof params.system === "string") return params.system;
  if (Array.isArray(params.system)) {
    return params.system
      .map((block: any) => {
        if (block.type === "text") return block.text;
        if (block.type === "image") return "[IMAGE]";
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function extractInputMessages(params: any): string {
  if (!params.messages || params.messages.length === 0) return "";
  return params.messages
    .map((message: any) => {
      const role = message.role;
      let content = "";
      if (typeof message.content === "string") {
        content = message.content;
      } else if (Array.isArray(message.content)) {
        content = message.content
          .map((block: any) => {
            if (block.type === "text") return block.text;
            if (block.type === "image") return "[IMAGE]";
            if (block.type === "tool_use") return `[TOOL_USE: ${block.name || "unknown"}]`;
            if (block.type === "tool_result") return "[TOOL_RESULT]";
            return "";
          })
          .filter(Boolean)
          .join("\n");
      }
      return `[${role}]\n${content}`;
    })
    .join("\n\n");
}

function extractOutputResponse(response: any): string {
  if (!response?.content || response.content.length === 0) return "";
  return response.content
    .map((block: any) => {
      if (block.type === "text") return block.text;
      if (block.type === "tool_use") return `[TOOL_USE: ${block.name}]`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function extractAnthropicPrompts(
  requestBody: any,
  response: any,
  metadata?: UsageMetadata,
): {
  systemPrompt?: string;
  inputMessages?: string;
  outputResponse?: string;
  promptsTruncated: boolean;
} | null {
  if (!shouldCapturePrompts(metadata)) return null;

  const maxSize = getMaxPromptSize();
  let anyTruncated = false;

  const systemPromptResult = truncateString(extractSystemPrompt(requestBody), maxSize);
  anyTruncated = anyTruncated || systemPromptResult.truncated;

  const inputMessagesResult = truncateString(extractInputMessages(requestBody), maxSize);
  anyTruncated = anyTruncated || inputMessagesResult.truncated;

  const outputResponseResult = truncateString(extractOutputResponse(response), maxSize);
  anyTruncated = anyTruncated || outputResponseResult.truncated;

  if (!systemPromptResult.value && !inputMessagesResult.value && !outputResponseResult.value)
    return null;

  return {
    systemPrompt: systemPromptResult.value || undefined,
    inputMessages: inputMessagesResult.value || undefined,
    outputResponse: outputResponseResult.value || undefined,
    promptsTruncated: anyTruncated,
  };
}

export function extractUsageFromResponse(response: any): {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  stopReason?: string;
} {
  const usage = response?.usage || {};
  return {
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    cacheCreationTokens: usage.cache_creation_input_tokens,
    cacheReadTokens: usage.cache_read_input_tokens,
    stopReason: response?.stop_reason,
  };
}

export function extractUsageFromStream(chunks: any[]): {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  stopReason?: string;
} {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheCreationTokens: number | undefined;
  let cacheReadTokens: number | undefined;
  let stopReason: string | undefined;

  for (const chunk of chunks) {
    let usage = null;

    if (chunk?.type === "message_start" && chunk?.message?.usage) {
      usage = chunk.message.usage;
    } else if (chunk?.usage) {
      usage = chunk.usage;
    } else if (chunk?.delta?.usage) {
      usage = chunk.delta.usage;
    }

    if (usage?.input_tokens) {
      inputTokens = Math.max(inputTokens, usage.input_tokens);
    }
    if (usage?.output_tokens) {
      outputTokens = Math.max(outputTokens, usage.output_tokens);
    }
    if (usage?.cache_creation_input_tokens) {
      cacheCreationTokens = usage.cache_creation_input_tokens;
    }
    if (usage?.cache_read_input_tokens) {
      cacheReadTokens = usage.cache_read_input_tokens;
    }
    if (chunk?.delta?.stop_reason) {
      stopReason = chunk.delta.stop_reason;
    }
  }

  return {
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    stopReason,
  };
}

export function reconstructResponseFromChunks(chunks: any[], model: string): any {
  const contentBlocks: any[] = [];
  let stopReason: string | undefined;
  let stopSequence: string | undefined;
  const usage: any = {};

  for (const chunk of chunks) {
    if (chunk.type === "content_block_start" && chunk.content_block) {
      contentBlocks.push({ ...chunk.content_block });
    } else if (chunk.type === "content_block_delta" && chunk.delta) {
      const lastBlock = contentBlocks[contentBlocks.length - 1];
      if (lastBlock && chunk.delta.type === "text_delta") {
        if (lastBlock.type === "text") {
          lastBlock.text = (lastBlock.text || "") + (chunk.delta.text || "");
        }
      } else if (lastBlock && chunk.delta.type === "input_json_delta") {
        if (lastBlock.type === "tool_use") {
          lastBlock.input = lastBlock.input || "";
          lastBlock.input += chunk.delta.partial_json || "";
        }
      }
    } else if (chunk.type === "message_delta" && chunk.delta) {
      if (chunk.delta.stop_reason) stopReason = chunk.delta.stop_reason;
      if (chunk.delta.stop_sequence) stopSequence = chunk.delta.stop_sequence;
    } else if (chunk.type === "message_start" && chunk.message?.usage) {
      Object.assign(usage, chunk.message.usage);
    } else if (chunk.usage) {
      Object.assign(usage, chunk.usage);
    }
  }

  return {
    id: `reconstructed-${Date.now()}`,
    type: "message",
    role: "assistant",
    content: contentBlocks,
    model,
    stop_reason: stopReason || "end_turn",
    stop_sequence: stopSequence,
    usage: {
      input_tokens: usage.input_tokens || 0,
      output_tokens: usage.output_tokens || 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens,
      cache_read_input_tokens: usage.cache_read_input_tokens,
    },
  };
}

export function trackUsageAsync(data: AnthropicTrackingData): void {
  const config = getConfig();
  const logger = getLogger();

  if (!config) {
    logger.warn("Revenium configuration not available - skipping tracking", {
      requestId: data.requestId,
    });
    return;
  }

  const promptData =
    data.requestBody && data.response
      ? extractAnthropicPrompts(data.requestBody, data.response, data.metadata)
      : null;

  const failSilent = config.failSilent ?? DEFAULT_CONFIG.FAIL_SILENT;
  const maxRetries = config.maxRetries ?? DEFAULT_CONFIG.MAX_RETRIES;

  void (async () => {
    let payload: ReveniumPayload | undefined;
    try {
      payload = await buildPayload({
        operationType: "CHAT",
        model: data.model,
        requestId: data.requestId,
        startTime: data.requestTime.getTime(),
        duration: data.duration,
        provider: "Anthropic",
        modelSource: "ANTHROPIC",
        middlewareSource: MIDDLEWARE_SOURCE,
        usageMetadata: data.metadata,
        usage: {
          prompt_tokens: data.inputTokens,
          completion_tokens: data.outputTokens,
          total_tokens: data.inputTokens + data.outputTokens,
          cache_creation_tokens: data.cacheCreationTokens || 0,
          cached_tokens: data.cacheReadTokens || 0,
        },
        stopReason: mapStopReason(data.stopReason, logger),
        isStreamed: data.isStreamed,
        timeToFirstToken: data.timeToFirstToken,
        promptData,
        attributes:
          data.hasVisionContent !== undefined
            ? { hasVisionContent: data.hasVisionContent }
            : undefined,
      });

      await getAnthropicCircuitBreaker().execute(async () => {
        return withRetry(async () => {
          await sendToRevenium(payload!);
        }, maxRetries);
      });
    } catch (error) {
      logger.warn("Anthropic tracking failed", {
        error: error instanceof Error ? error.message : String(error),
        requestId: data.requestId,
      });

      if (!failSilent) {
        throw error;
      }
    } finally {
      if (payload) {
        printUsageSummary(payload);
      }
    }
  })();
}
