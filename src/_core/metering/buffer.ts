import { getConfig, getLogger } from "../config/manager.js";
import { BUFFER_CONFIG } from "../constants.js";
import { HttpError, isRetryableStatus } from "../resilience/retry.js";

export interface BufferEntry {
  url: string;
  headers: Record<string, string>;
  body: string;
  createdAt: number;
}

export interface BufferStats {
  size: number;
  oldestEventAgeMs: number | null;
  totalBuffered: number;
  totalFlushed: number;
  totalDropped: number;
  totalEvicted: number;
  totalExpired: number;
}

class MeteringBuffer {
  private buffer: BufferEntry[] = [];
  private maxSize: number;
  private flushIntervalMs: number;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private totalBuffered = 0;
  private totalFlushed = 0;
  private totalDropped = 0;
  private totalEvicted = 0;
  private totalExpired = 0;
  private exitHandler: (() => void) | null = null;
  private signalHandler: (() => void) | null = null;

  constructor(
    maxSize: number = BUFFER_CONFIG.MAX_SIZE,
    flushIntervalMs: number = BUFFER_CONFIG.FLUSH_INTERVAL_MS,
  ) {
    this.maxSize = maxSize;
    this.flushIntervalMs = flushIntervalMs;
  }

  push(entry: BufferEntry): void {
    const logger = getLogger();

    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
      this.totalEvicted++;
      logger.warn("Metering buffer full, evicting oldest event", {
        bufferSize: this.maxSize,
        totalEvicted: this.totalEvicted,
      });
    }

    this.buffer.push(entry);
    this.totalBuffered++;

    logger.debug("Metering event buffered", {
      bufferDepth: this.buffer.length,
      totalBuffered: this.totalBuffered,
    });

    this.ensureFlushLoop();
    this.ensureExitHandler();
  }

  async flush(): Promise<void> {
    if (this.isFlushing) return;
    this.isFlushing = true;

    const logger = getLogger();

    try {
      while (this.buffer.length > 0) {
        const entry = this.buffer[0];

        if (Date.now() - entry.createdAt > BUFFER_CONFIG.MAX_AGE_MS) {
          this.buffer.shift();
          this.totalExpired++;
          logger.debug("Buffered event expired (>24h), discarding", {
            totalExpired: this.totalExpired,
          });
          continue;
        }

        const result = await this.sendOne(entry);
        if (result === "retry") break;

        this.buffer.shift();
        if (result === "sent") {
          this.totalFlushed++;
        } else {
          this.totalDropped++;
          logger.debug("Buffered event dropped (terminal error)", {
            totalDropped: this.totalDropped,
          });
        }
      }

      if (this.buffer.length === 0 && this.flushTimer) {
        clearInterval(this.flushTimer);
        this.flushTimer = null;
      }

      logger.debug("Metering buffer flush complete", {
        remaining: this.buffer.length,
        totalFlushed: this.totalFlushed,
        totalDropped: this.totalDropped,
      });
    } finally {
      this.isFlushing = false;
    }
  }

  getStats(): BufferStats {
    return {
      size: this.buffer.length,
      oldestEventAgeMs: this.buffer.length > 0 ? Date.now() - this.buffer[0].createdAt : null,
      totalBuffered: this.totalBuffered,
      totalFlushed: this.totalFlushed,
      totalDropped: this.totalDropped,
      totalEvicted: this.totalEvicted,
      totalExpired: this.totalExpired,
    };
  }

  configure(maxSize: number, flushIntervalMs: number): void {
    this.maxSize = maxSize;
    this.flushIntervalMs = flushIntervalMs;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
      if (this.buffer.length > 0) {
        this.ensureFlushLoop();
      }
    }
  }

  reset(): void {
    this.buffer = [];
    this.isFlushing = false;
    this.totalBuffered = 0;
    this.totalFlushed = 0;
    this.totalDropped = 0;
    this.totalEvicted = 0;
    this.totalExpired = 0;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.removeExitHandlers();
  }

  private async sendOne(entry: BufferEntry): Promise<"sent" | "dropped" | "retry"> {
    const logger = getLogger();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BUFFER_CONFIG.FLUSH_TIMEOUT_MS);

    try {
      const response = await fetch(entry.url, {
        method: "POST",
        headers: entry.headers,
        body: entry.body,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (response.ok) return "sent";
      if (!isRetryableStatus(response.status)) return "dropped";
      return "retry";
    } catch (error) {
      logger.debug("Buffer flush fetch failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return "retry";
    }
  }

  private ensureFlushLoop(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {});
    }, this.flushIntervalMs);
    this.flushTimer.unref();
  }

  private ensureExitHandler(): void {
    if (this.exitHandler) return;

    this.exitHandler = () => {
      this.flush().catch(() => {});
    };

    this.signalHandler = () => {
      this.flush()
        .catch(() => {})
        .finally(() => process.exit());
    };

    process.on("beforeExit", this.exitHandler);
    process.on("SIGTERM", this.signalHandler);
    process.on("SIGINT", this.signalHandler);
  }

  private removeExitHandlers(): void {
    if (this.exitHandler) {
      process.removeListener("beforeExit", this.exitHandler);
      this.exitHandler = null;
    }
    if (this.signalHandler) {
      process.removeListener("SIGTERM", this.signalHandler);
      process.removeListener("SIGINT", this.signalHandler);
      this.signalHandler = null;
    }
  }
}

let instance: MeteringBuffer | null = null;

export function getMeteringBuffer(): MeteringBuffer {
  if (!instance) {
    const config = getConfig();
    instance = new MeteringBuffer(
      config?.bufferMaxSize ?? BUFFER_CONFIG.MAX_SIZE,
      config?.bufferFlushIntervalMs ?? BUFFER_CONFIG.FLUSH_INTERVAL_MS,
    );
  }
  return instance;
}

export function flushMeteringBuffer(): Promise<void> {
  return getMeteringBuffer().flush();
}

export function getBufferStats(): BufferStats {
  return getMeteringBuffer().getStats();
}

export function resetMeteringBuffer(): void {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

export function shouldBufferError(error: unknown): boolean {
  if (error instanceof Error && error.message.includes("Circuit breaker is OPEN")) {
    return true;
  }

  if (error instanceof HttpError) {
    return isRetryableStatus(error.status);
  }

  if (error instanceof TypeError) return true;
  if (error instanceof Error && error.name === "AbortError") return true;

  return false;
}
