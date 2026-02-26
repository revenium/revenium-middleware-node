import type { UsageMetadata } from "../_core/types/index.js";

export interface PerplexityCost {
  input_tokens_cost: number;
  output_tokens_cost: number;
  request_cost: number;
  total_cost: number;
}

export interface PerplexityUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  search_context_size?: string;
  cost?: PerplexityCost;
}

export interface PerplexityChoice {
  index: number;
  message?: {
    role: string;
    content: string;
  };
  delta?: {
    role?: string;
    content?: string;
  };
  finish_reason: string | null;
}

export interface PerplexityResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: PerplexityChoice[];
  usage?: PerplexityUsage;
}

export interface PerplexityChatRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
  response_format?: { type: string; json_schema?: { name: string } } | string;
  usageMetadata?: UsageMetadata;
}

export interface PerplexityStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: PerplexityChoice[];
}
