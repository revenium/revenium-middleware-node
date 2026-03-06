import type { UsageMetadata, OperationType } from "../_core/types/index.js";

export interface FalConfig {
  falApiKey?: string;
  reveniumApiKey: string;
  reveniumBaseUrl?: string;
  organizationName?: string;
  organizationId?: string;
  debug?: boolean;
  printSummary?: boolean | "human" | "json";
  teamId?: string;
  capturePrompts?: boolean;
  maxPromptSize?: number;
  failSilent?: boolean;
  maxRetries?: number;
}

export interface FalUsageMetadata extends UsageMetadata {
  environment?: string;
  operationSubtype?: string;
  retryNumber?: number;
  parentTransactionId?: string;
  transactionName?: string;
  region?: string;
  credentialAlias?: string;
  traceType?: string;
  traceName?: string;
}

export interface FalTrackingData {
  endpointId: string;
  operationType: OperationType;
  startTime: number;
  duration: number;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  isStreamed: boolean;
  requestId?: string;
  usageMetadata?: FalUsageMetadata;
}

export interface FalImageResult {
  images?: Array<{ url: string; width?: number; height?: number; content_type?: string }>;
  timings?: Record<string, number>;
  seed?: number;
  has_nsfw_concepts?: boolean[];
}

export interface FalVideoResult {
  video?: { url: string; content_type?: string; file_name?: string; file_size?: number };
  file_url?: string;
  timings?: Record<string, number>;
}

export interface FalAudioResult {
  audio_url?: string;
  audio?: { url: string; content_type?: string };
  file_url?: string;
  duration?: number;
  text?: string;
  timings?: Record<string, number>;
}

export interface FalChatResult {
  output?: string;
  reasoning?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
}
