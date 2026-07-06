import { RETRY_CONFIG, RETRYABLE_STATUSES } from "../constants.js";

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;

  const seconds = Number(header);
  if (!isNaN(seconds) && isFinite(seconds)) {
    return Math.max(0, seconds);
  }

  const date = new Date(header);
  if (!isNaN(date.getTime())) {
    return Math.max(0, (date.getTime() - Date.now()) / 1000);
  }

  return undefined;
}

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof HttpError) {
    return isRetryableStatus(error.status);
  }
  if (error instanceof TypeError) return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}

function isTerminalHttpError(error: unknown): boolean {
  if (!(error instanceof HttpError)) return false;
  return !isRetryableStatus(error.status);
}

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

      if (isTerminalHttpError(error)) throw error;
      if (attempt === maxRetries) break;
      if (!isRetryableError(error)) break;

      let delay: number;
      if (error instanceof HttpError && error.retryAfterSeconds !== undefined) {
        delay = Math.min(
          error.retryAfterSeconds * 1000,
          RETRY_CONFIG.MAX_RETRY_AFTER_SECONDS * 1000,
        );
      } else {
        delay = Math.min(baseDelay * Math.pow(2, attempt), RETRY_CONFIG.MAX_DELAY);
        const jitter = Math.random() * RETRY_CONFIG.JITTER_FACTOR * delay;
        delay = delay + jitter;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
