import { getLogger } from "../config/manager.js";

export interface StreamTrackingParams {
  model: string;
  middlewareSource: string;
  provider: string;
  modelSource: string;
  onComplete: (params: StreamCompletionParams) => void;
}

export interface StreamCompletionParams {
  requestId: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens?: number;
    cached_tokens?: number;
    cache_creation_tokens?: number;
  };
  duration: number;
  finishReason: string | null;
  isStreamed: true;
  timeToFirstToken?: number;
  accumulatedContent?: string;
}

export abstract class BaseStreamWrapper<TChunk> implements AsyncIterable<TChunk> {
  protected startTime: number;
  protected firstTokenTime?: number;
  protected requestId: string;
  protected usage: any = {};
  protected accumulatedContent: string = "";
  private completed = false;

  constructor(
    protected stream: AsyncIterable<TChunk>,
    protected params: StreamTrackingParams,
  ) {
    this.startTime = Date.now();
    this.requestId = "";
  }

  protected abstract extractChunkContent(chunk: TChunk): string | undefined;
  protected abstract extractChunkUsage(chunk: TChunk): any | undefined;
  protected abstract extractChunkId(chunk: TChunk): string | undefined;
  protected abstract hasFirstTokenContent(chunk: TChunk): boolean;

  async *[Symbol.asyncIterator](): AsyncIterator<TChunk> {
    const logger = getLogger();

    try {
      for await (const chunk of this.stream) {
        if (!this.firstTokenTime && this.hasFirstTokenContent(chunk)) {
          this.firstTokenTime = Date.now();
        }

        const content = this.extractChunkContent(chunk);
        if (content) {
          this.accumulatedContent += content;
        }

        const usage = this.extractChunkUsage(chunk);
        if (usage) {
          this.usage = usage;
        }

        const id = this.extractChunkId(chunk);
        if (id) {
          this.requestId = id;
        }

        yield chunk;
      }

      this.completed = true;
      const timeToFirstToken = this.firstTokenTime
        ? this.firstTokenTime - this.startTime
        : undefined;

      this.params.onComplete({
        requestId: this.requestId,
        model: this.params.model,
        usage: this.usage,
        duration: Date.now() - this.startTime,
        finishReason: null,
        isStreamed: true,
        timeToFirstToken,
        accumulatedContent: this.accumulatedContent || undefined,
      });

      logger.debug("Streaming completed", {
        requestId: this.requestId,
        model: this.params.model,
        duration: Date.now() - this.startTime,
      });
    } catch (error) {
      this.completed = true;
      this.params.onComplete({
        requestId: this.requestId,
        model: this.params.model,
        usage: this.usage,
        duration: Date.now() - this.startTime,
        finishReason: "error",
        isStreamed: true,
      });

      logger.error("Streaming error", {
        error: error instanceof Error ? error.message : String(error),
        requestId: this.requestId,
      });

      throw error;
    } finally {
      if (!this.completed) {
        const timeToFirstToken = this.firstTokenTime
          ? this.firstTokenTime - this.startTime
          : undefined;

        this.params.onComplete({
          requestId: this.requestId,
          model: this.params.model,
          usage: this.usage,
          duration: Date.now() - this.startTime,
          finishReason: "cancelled",
          isStreamed: true,
          timeToFirstToken,
        });
      }
    }
  }
}
