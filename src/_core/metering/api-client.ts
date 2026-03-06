import { ReveniumPayload } from "../types/index.js";
import { getConfig, getLogger } from "../config/manager.js";
import { buildReveniumUrl } from "./url-builder.js";
import { DEFAULT_REVENIUM_BASE_URL, API_ENDPOINTS } from "../constants.js";
import { executeWithCircuitBreaker } from "../resilience/circuit-breaker.js";

export async function sendToRevenium(payload: ReveniumPayload): Promise<void> {
  const config = getConfig();
  const logger = getLogger();

  if (!config) {
    logger.warn("Revenium configuration not found, skipping tracking");
    return;
  }

  let endpoint: string = API_ENDPOINTS.AI_COMPLETIONS;
  if (payload.operationType === "IMAGE") {
    endpoint = API_ENDPOINTS.AI_IMAGES;
  } else if (payload.operationType === "AUDIO") {
    endpoint = API_ENDPOINTS.AI_AUDIO;
  } else if (payload.operationType === "VIDEO") {
    endpoint = API_ENDPOINTS.AI_VIDEO;
  }

  const url = buildReveniumUrl(config.reveniumBaseUrl || DEFAULT_REVENIUM_BASE_URL, endpoint);

  logger.debug("Sending Revenium API request", {
    url,
    operationType: payload.operationType,
    transactionId: payload.transactionId,
    model: payload.model,
    totalTokens: payload.totalTokenCount,
  });

  await executeWithCircuitBreaker(async () => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": config.reveniumApiKey,
      },
      body: JSON.stringify(payload),
    });

    logger.debug("Revenium API response", {
      status: response.status,
      statusText: response.statusText,
      transactionId: payload.transactionId,
      operationType: payload.operationType,
    });

    if (!response.ok) {
      const responseText = await response.text();
      logger.error("Revenium API error response", {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
        transactionId: payload.transactionId,
      });
      throw new Error(
        `Revenium API error: ${response.status} ${response.statusText} - ${responseText}`,
      );
    }

    logger.debug("Revenium tracking successful", {
      transactionId: payload.transactionId,
      operationType: payload.operationType,
    });
  });
}
