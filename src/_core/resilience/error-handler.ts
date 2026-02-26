export class ReveniumError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "ReveniumError";
    this.code = code;
    this.context = context;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReveniumError);
    }
  }
}

export class ConfigurationError extends ReveniumError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "CONFIGURATION_ERROR", context);
    this.name = "ConfigurationError";
  }
}

export class RequestProcessingError extends ReveniumError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "REQUEST_PROCESSING_ERROR", context);
    this.name = "RequestProcessingError";
  }
}

export class ReveniumApiError extends ReveniumError {
  public readonly statusCode?: number;
  public readonly responseBody?: string;

  constructor(
    message: string,
    statusCode?: number,
    responseBody?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, "REVENIUM_API_ERROR", context);
    this.name = "ReveniumApiError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class ValidationError extends ReveniumError {
  public readonly validationErrors: string[];

  constructor(message: string, validationErrors: string[], context?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", context);
    this.name = "ValidationError";
    this.validationErrors = validationErrors;
  }
}

export class StreamProcessingError extends ReveniumError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "STREAM_PROCESSING_ERROR", context);
    this.name = "StreamProcessingError";
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown error occurred";
}

export function safeAsyncOperation<T>(
  fn: () => Promise<T>,
  logger: { error: (message: string, meta?: Record<string, unknown>) => void },
  operationName: string,
): Promise<T | undefined> {
  return fn().catch((error) => {
    logger.error(`${operationName} failed safely`, {
      error: getErrorMessage(error),
    });
    return undefined;
  });
}
