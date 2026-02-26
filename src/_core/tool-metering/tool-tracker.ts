import { randomUUID } from "crypto";
import { ToolMetadata, ToolCallReport, ToolEventPayload } from "../types/tool-metering.js";
import { getToolContext } from "./tool-context.js";
import { sendToolEvent } from "./tool-api-client.js";
import { getLogger } from "../config/manager.js";

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    value !== null && typeof value === "object" && typeof (value as Promise<T>).then === "function"
  );
}

function extractOutputFields(result: unknown, fields: string[]): Record<string, unknown> {
  if (typeof result !== "object" || result === null) return {};
  const extracted: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in result) {
      extracted[field] = (result as Record<string, unknown>)[field];
    }
  }
  return extracted;
}

function buildToolEventPayload(
  toolId: string,
  durationMs: number,
  success: boolean,
  middlewareSource: string,
  metadata?: ToolMetadata,
  errorMessage?: string,
): ToolEventPayload {
  const context = getToolContext();
  const transactionId = metadata?.transactionId ?? context.transactionId ?? randomUUID();

  return {
    transactionId,
    toolId,
    operation: metadata?.operation,
    durationMs,
    success,
    timestamp: new Date().toISOString(),
    errorMessage,
    usageMetadata: metadata?.usageMetadata,
    agent: metadata?.agent ?? context.agent,
    organizationName: metadata?.organizationName ?? context.organizationName,
    productName: metadata?.productName ?? context.productName,
    subscriberCredential: metadata?.subscriberCredential ?? context.subscriberCredential,
    workflowId: metadata?.workflowId ?? context.workflowId,
    traceId: metadata?.traceId ?? context.traceId,
    middlewareSource,
  };
}

function dispatchToolEvent(payload: ToolEventPayload): void {
  const logger = getLogger();
  sendToolEvent(payload)
    .then(() => {
      logger.debug("Tool event sent successfully", {
        transactionId: payload.transactionId,
        toolId: payload.toolId,
      });
    })
    .catch((error) => {
      logger.warn("Failed to send tool event", {
        transactionId: payload.transactionId,
        toolId: payload.toolId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

export function meterTool<T>(
  toolId: string,
  fn: () => T | Promise<T>,
  metadata?: ToolMetadata,
  middlewareSource: string = "revenium-node",
): Promise<T> {
  const startTime = performance.now();

  const handleSuccess = (result: T): T => {
    const durationMs = Math.round(performance.now() - startTime);
    let finalMetadata = metadata;

    if (metadata?.outputFields && metadata.outputFields.length > 0) {
      const extracted = extractOutputFields(result, metadata.outputFields);
      finalMetadata = {
        ...metadata,
        usageMetadata: { ...metadata.usageMetadata, ...extracted },
      };
    }

    const payload = buildToolEventPayload(
      toolId,
      durationMs,
      true,
      middlewareSource,
      finalMetadata,
    );
    dispatchToolEvent(payload);
    return result;
  };

  const handleError = (error: unknown): never => {
    const durationMs = Math.round(performance.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const payload = buildToolEventPayload(
      toolId,
      durationMs,
      false,
      middlewareSource,
      metadata,
      errorMessage,
    );
    dispatchToolEvent(payload);
    throw error;
  };

  try {
    const result = fn();
    if (isPromise<T>(result)) {
      return result.then(handleSuccess, handleError);
    }
    return Promise.resolve(handleSuccess(result));
  } catch (error) {
    return Promise.reject(handleError(error));
  }
}

export function reportToolCall(
  toolId: string,
  report: ToolCallReport,
  middlewareSource: string = "revenium-node",
): void {
  const context = getToolContext();
  const transactionId = report.transactionId ?? context.transactionId ?? randomUUID();

  const payload: ToolEventPayload = {
    transactionId,
    toolId,
    operation: report.operation,
    durationMs: report.durationMs,
    success: report.success,
    timestamp: report.timestamp ?? new Date().toISOString(),
    errorMessage: report.errorMessage,
    usageMetadata: report.usageMetadata,
    agent: report.agent ?? context.agent,
    organizationName: report.organizationName ?? context.organizationName,
    productName: report.productName ?? context.productName,
    subscriberCredential: report.subscriberCredential ?? context.subscriberCredential,
    workflowId: report.workflowId ?? context.workflowId,
    traceId: report.traceId ?? context.traceId,
    middlewareSource,
  };

  dispatchToolEvent(payload);
}
