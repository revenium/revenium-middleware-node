import { UsageMetadata } from "../_core/types/index.js";

export {};

declare module "openai/resources/chat/completions/completions" {
  interface ChatCompletionCreateParamsBase {
    usageMetadata?: UsageMetadata;
  }

  interface ChatCompletionCreateParamsNonStreaming {
    usageMetadata?: UsageMetadata;
  }

  interface ChatCompletionCreateParamsStreaming {
    usageMetadata?: UsageMetadata;
  }
}

declare module "openai/resources/embeddings" {
  interface EmbeddingCreateParams {
    usageMetadata?: UsageMetadata;
  }
}

declare module "openai" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Responses {
    interface ResponseCreateParams {
      usageMetadata?: UsageMetadata;
    }
  }
}
