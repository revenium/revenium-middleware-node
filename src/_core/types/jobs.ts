export type ExecutionStatus = "SUCCESS" | "FAILED" | "CANCELLED";
export type OutcomeType = "CONVERTED" | "ESCALATED" | "DEFLECTED" | "CUSTOM";

export interface JobOutcome {
  executionStatus: ExecutionStatus;
  outcomeType?: OutcomeType;
  outcomeValue?: number;
  outcomeCurrency?: string;
  metadata?: string;
  reportedBy?: string;
}

export interface JobResource {
  id: string;
  label: string;
  resourceType: string;
  created?: string;
  updated?: string;
  agenticJobId: string;
  name?: string;
  type?: string;
  version?: string;
  source: string;
  executionStatus?: string;
  outcomeType?: string;
  outcomeValue?: number;
  outcomeCurrency?: string;
  outcomeReportedAt?: string;
  outcomeMetadata?: string;
  hasOutcome: boolean;
}

export interface JobROIResource {
  agenticJobId: string;
  agenticJobName?: string;
  agenticJobType?: string;
  totalCost: number;
  outcomeValue: number | null;
  outcomeCurrency: string | null;
  roi: number | null;
  executionStatus: string | null;
  outcomeType: string | null;
  hasOutcome: boolean;
  transactionCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface JobTimelineEvent {
  transactionId: string;
  timestamp: string;
  agent?: string | null;
  model?: string;
  provider?: string;
  duration?: number;
  cost?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  status?: string;
}

export interface JobTimelineResource {
  transactions: JobTimelineEvent[];
  totalCount: number;
}

export interface ConversionFunnelResource {
  totalJobs: number;
  successfulJobs: number;
  convertedJobs: number;
  successRate: number;
  conversionRate: number;
}

export interface ListJobsParams {
  type?: string;
  executionStatus?: string;
  outcomeType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export interface ConversionFunnelParams {
  startDate?: string;
  endDate?: string;
  jobType?: string;
}

export interface PageInfo {
  size: number;
  totalElements: number;
  totalPages: number;
  number: number;
}

export interface PagedResponse<T> {
  content: T[];
  page: PageInfo;
}
