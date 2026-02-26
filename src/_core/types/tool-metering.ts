export interface ToolContext {
  agent?: string;
  organizationName?: string;
  productName?: string;
  subscriberCredential?: string;
  workflowId?: string;
  traceId?: string;
  transactionId?: string;
}

export interface ToolMetadata extends ToolContext {
  operation?: string;
  outputFields?: string[];
  usageMetadata?: Record<string, unknown>;
}

export interface ToolEventPayload {
  transactionId: string;
  toolId: string;
  operation?: string;
  durationMs: number;
  success: boolean;
  timestamp: string;
  errorMessage?: string;
  usageMetadata?: Record<string, unknown>;
  agent?: string;
  organizationName?: string;
  productName?: string;
  subscriberCredential?: string;
  workflowId?: string;
  traceId?: string;
  middlewareSource: string;
}

export interface ToolCallReport {
  operation?: string;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  usageMetadata?: Record<string, unknown>;
  agent?: string;
  organizationName?: string;
  productName?: string;
  subscriberCredential?: string;
  workflowId?: string;
  traceId?: string;
  transactionId?: string;
  timestamp?: string;
}
