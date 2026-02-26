import { ToolEventPayload } from "../types/tool-metering.js";
import { getConfig, getLogger } from "../config/manager.js";
import { buildReveniumUrl } from "../metering/url-builder.js";
import { DEFAULT_REVENIUM_BASE_URL, API_ENDPOINTS } from "../constants.js";

export async function sendToolEvent(payload: ToolEventPayload): Promise<void> {
  const config = getConfig();
  const logger = getLogger();

  if (!config) {
    logger.warn("Revenium configuration not found, skipping tool event tracking");
    return;
  }

  const url = buildReveniumUrl(
    config.reveniumBaseUrl || DEFAULT_REVENIUM_BASE_URL,
    API_ENDPOINTS.TOOL_EVENTS,
  );

  logger.debug("Sending tool event to Revenium", {
    url,
    toolId: payload.toolId,
    transactionId: payload.transactionId,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": config.reveniumApiKey,
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));

  if (!response.ok) {
    const responseText = await response.text();
    logger.error("Tool event API error", {
      status: response.status,
      body: responseText,
    });
    throw new Error(`Revenium tool event API error: ${response.status} ${response.statusText}`);
  }
}
