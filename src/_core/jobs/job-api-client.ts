import { getConfig, getLogger } from "../config/manager.js";
import { DEFAULT_REVENIUM_BASE_URL, API_ENDPOINTS } from "../constants.js";
import type {
  JobOutcome,
  JobResource,
  JobROIResource,
  JobTimelineResource,
  ConversionFunnelResource,
  ListJobsParams,
  ConversionFunnelParams,
  PageInfo,
  PagedResponse,
} from "../types/jobs.js";

function buildJobRequest(
  path: string,
  teamId?: string,
): { url: string; headers: Record<string, string> } {
  const config = getConfig();

  const resolvedTeamId = teamId || config?.teamId;
  if (!resolvedTeamId) {
    throw new Error(
      "teamId is required: provide it as a parameter or set REVENIUM_TEAM_ID environment variable",
    );
  }

  if (!config?.reveniumApiKey) {
    throw new Error(
      "Revenium API key is not configured: set REVENIUM_METERING_API_KEY environment variable or provide reveniumApiKey in config",
    );
  }

  const baseUrl = (config.reveniumBaseUrl || DEFAULT_REVENIUM_BASE_URL)
    .replace(/\/+$/, "")
    .replace(/\/meter(\/v2)?$/, "");
  const separator = path.includes("?") ? "&" : "?";
  const url = `${baseUrl}${API_ENDPOINTS.JOBS}${path}${separator}teamId=${encodeURIComponent(resolvedTeamId)}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-api-key": config.reveniumApiKey,
  };

  return { url, headers };
}

async function handleResponse<T>(response: Response, errorContext: string): Promise<T> {
  if (response.status === 404) {
    throw new Error(`${errorContext}: not found`);
  }

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`${errorContext}: ${response.status} ${response.statusText} - ${responseText}`);
  }

  return (await response.json()) as T;
}

export async function reportJobOutcome(
  jobId: string,
  outcome: JobOutcome,
  teamId?: string,
): Promise<JobResource> {
  const logger = getLogger();
  const { url, headers } = buildJobRequest(`/${encodeURIComponent(jobId)}/outcome`, teamId);

  logger.debug("Reporting job outcome", { jobId, url });

  const response = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(outcome),
  });

  if (response.status === 409) {
    logger.warn(`Job outcome already reported for job ${jobId}`);
    try {
      return (await response.json()) as JobResource;
    } catch {
      return {
        id: "",
        label: "",
        resourceType: "JOB",
        agenticJobId: jobId,
        source: "SDK",
        hasOutcome: true,
      } as JobResource;
    }
  }

  return handleResponse<JobResource>(response, `Failed to report job outcome for ${jobId}`);
}

export async function listJobs(
  params: ListJobsParams & { teamId?: string } = {},
): Promise<PagedResponse<JobResource>> {
  const { teamId, ...queryParams } = params;
  const queryString = buildQueryString(queryParams);
  const path = queryString ? `?${queryString}` : "";
  const { url, headers } = buildJobRequest(path, teamId);

  const response = await fetch(url, { method: "GET", headers });
  const raw = await handleResponse<SpringPageResponse>(response, "Failed to list jobs");
  return normalizePagedResponse<JobResource>(raw);
}

export async function getJob(jobId: string, teamId?: string): Promise<JobResource> {
  const { url, headers } = buildJobRequest(`/${encodeURIComponent(jobId)}`, teamId);

  const response = await fetch(url, { method: "GET", headers });
  return handleResponse<JobResource>(response, `Failed to get job ${jobId}`);
}

export async function getJobTypes(teamId?: string): Promise<string[]> {
  const { url, headers } = buildJobRequest("/types", teamId);

  const response = await fetch(url, { method: "GET", headers });
  return handleResponse<string[]>(response, "Failed to get job types");
}

export async function getJobROI(jobId: string, teamId?: string): Promise<JobROIResource> {
  const { url, headers } = buildJobRequest(`/${encodeURIComponent(jobId)}/roi`, teamId);

  const response = await fetch(url, { method: "GET", headers });
  return handleResponse<JobROIResource>(response, `Failed to get job ROI for ${jobId}`);
}

export async function getJobTransactions(
  jobId: string,
  teamId?: string,
): Promise<JobTimelineResource> {
  const { url, headers } = buildJobRequest(`/${encodeURIComponent(jobId)}/transactions`, teamId);

  const response = await fetch(url, { method: "GET", headers });
  return handleResponse<JobTimelineResource>(
    response,
    `Failed to get job transactions for ${jobId}`,
  );
}

export async function getConversionFunnel(
  params: ConversionFunnelParams & { teamId?: string } = {},
): Promise<ConversionFunnelResource> {
  const { teamId, ...queryParams } = params;
  const queryString = buildQueryString(queryParams);
  const path = `/conversion-funnel${queryString ? `?${queryString}` : ""}`;
  const { url, headers } = buildJobRequest(path, teamId);

  const response = await fetch(url, { method: "GET", headers });
  return handleResponse<ConversionFunnelResource>(response, "Failed to get conversion funnel");
}

interface SpringPageResponse {
  _embedded?: Record<string, unknown[]>;
  content?: unknown[];
  page?: PageInfo;
}

function normalizePagedResponse<T>(raw: SpringPageResponse): PagedResponse<T> {
  const embedded = raw._embedded;
  const items = raw.content ?? (embedded ? Object.values(embedded)[0] : undefined) ?? [];
  const page: PageInfo = raw.page ?? { size: items.length, totalElements: items.length, totalPages: 1, number: 0 };
  return { content: items as T[], page };
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}
