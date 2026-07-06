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
  outcomeUpdateCount?: number;
  outcomeUpdatedAt?: string | null;
  outcomeUpdatedBy?: string | null;
}

export interface JobOutcomeAmendment extends Partial<JobOutcome> {
  reason: string;
}

export interface JobOutcomeRevisionEntry {
  sequence: number;
  executionStatus: string;
  outcomeType: string | null;
  outcomeValue: number | null;
  outcomeCurrency: string | null;
  outcomeMetadata: string | null;
  reportedBy: string | null;
  reportedAt: string;
  reason: string | null;
}

export class OutcomeAlreadyReportedError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly reportedAt: string | null,
    public readonly updateCount: number | null,
    message?: string,
  ) {
    super(message ?? `Outcome already reported for job ${jobId}; use amendJobOutcome to update`);
    this.name = "OutcomeAlreadyReportedError";
  }
}

export class OutcomeNotReportedError extends Error {
  constructor(
    public readonly jobId: string,
    message?: string,
  ) {
    super(message ?? `No outcome reported yet for job ${jobId}; report an outcome before amending`);
    this.name = "OutcomeNotReportedError";
  }
}

export class OutcomeAmendConflictError extends Error {
  constructor(
    public readonly jobId: string,
    message?: string,
  ) {
    super(message ?? `Concurrent outcome update detected for job ${jobId}; refetch and retry`);
    this.name = "OutcomeAmendConflictError";
  }
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
