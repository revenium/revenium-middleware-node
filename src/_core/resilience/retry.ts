import { RETRY_CONFIG } from "../constants.js";

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = RETRY_CONFIG.BASE_DELAY,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;

      const delay = Math.min(baseDelay * Math.pow(2, attempt), RETRY_CONFIG.MAX_DELAY);
      const jitter = Math.random() * RETRY_CONFIG.JITTER_FACTOR * delay;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
}
