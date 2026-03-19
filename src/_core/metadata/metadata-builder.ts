import { UsageMetadata } from "../types/index.js";
import { getJobContext } from "../jobs/job-context.js";
import { ENV_VARS } from "../constants.js";

interface MetadataFieldConfig {
  source: keyof UsageMetadata;
  target?: string;
  transform?: (value: unknown) => unknown;
}

const METADATA_FIELD_MAP: MetadataFieldConfig[] = [
  { source: "traceId" },
  { source: "taskType" },
  { source: "agent" },
  { source: "organizationId" },
  { source: "organizationName" },
  { source: "productId" },
  { source: "productName" },
  { source: "subscriber" },
  { source: "subscriptionId" },
  {
    source: "responseQualityScore",
    transform: (value: unknown) => {
      if (typeof value === "number") return Math.max(0, Math.min(1, value));
      return value;
    },
  },
  { source: "agenticJobId" },
  { source: "agenticJobName" },
  { source: "agenticJobType" },
  { source: "agenticJobVersion" },
];

function getJobFieldsFromEnv(): Partial<
  Pick<UsageMetadata, "agenticJobId" | "agenticJobName" | "agenticJobType" | "agenticJobVersion">
> {
  const result: Record<string, string> = {};
  const envId = process.env[ENV_VARS.AGENTIC_JOB_ID];
  const envName = process.env[ENV_VARS.AGENTIC_JOB_NAME];
  const envType = process.env[ENV_VARS.AGENTIC_JOB_TYPE];
  const envVersion = process.env[ENV_VARS.AGENTIC_JOB_VERSION];
  if (envId) result.agenticJobId = envId;
  if (envName) result.agenticJobName = envName;
  if (envType) result.agenticJobType = envType;
  if (envVersion) result.agenticJobVersion = envVersion;
  return result;
}

export function buildMetadataFields(usageMetadata?: UsageMetadata): Record<string, unknown> {
  const envJobFields = getJobFieldsFromEnv();
  const jobContext = getJobContext();
  const merged: UsageMetadata = { ...envJobFields, ...jobContext, ...usageMetadata };

  if (!usageMetadata && !Object.keys(jobContext).length && !Object.keys(envJobFields).length) {
    return {};
  }

  const result: Record<string, unknown> = {};

  for (const config of METADATA_FIELD_MAP) {
    const value = merged[config.source];
    if (value === undefined) continue;

    if (config.source === "organizationId" || config.source === "productId") {
      continue;
    }

    const transformedValue = config.transform ? config.transform(value) : value;
    const targetField = config.target || config.source;
    result[targetField] = transformedValue;
  }

  if (merged.organizationName || merged.organizationId) {
    result.organizationName = merged.organizationName || merged.organizationId;
  }

  if (merged.productName || merged.productId) {
    result.productName = merged.productName || merged.productId;
  }

  return result;
}

export function validateMetadata(
  usageMetadata?: UsageMetadata,
  requiredFields: (keyof UsageMetadata)[] = [],
): { isValid: boolean; missingFields: string[]; warnings: string[] } {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (!usageMetadata && requiredFields.length > 0) {
    return {
      isValid: false,
      missingFields: requiredFields as string[],
      warnings: ["No metadata provided"],
    };
  }

  if (usageMetadata) {
    for (const field of requiredFields) {
      if (!usageMetadata[field]) missingFields.push(String(field));
    }

    if (usageMetadata.responseQualityScore) {
      const score = usageMetadata.responseQualityScore;
      if (typeof score !== "number" || score < 0 || score > 1) {
        warnings.push("responseQualityScore should be a number between 0.0 and 1.0");
      }
    }

    if (usageMetadata.subscriber?.email && !usageMetadata.subscriber.email.includes("@")) {
      warnings.push("subscriber.email does not appear to be a valid email address");
    }
  }

  return { isValid: missingFields.length === 0, missingFields, warnings };
}

export function mergeMetadata(...sources: (UsageMetadata | undefined)[]): UsageMetadata {
  const result: UsageMetadata = {};
  for (const source of sources.reverse()) {
    if (source) Object.assign(result, source);
  }
  return result;
}

export function extractMetadata<T extends Record<string, unknown>>(
  params: T & { usageMetadata?: UsageMetadata },
): { metadata: UsageMetadata | undefined; cleanParams: Omit<T, "usageMetadata"> } {
  const { usageMetadata, ...cleanParams } = params;
  return { metadata: usageMetadata, cleanParams: cleanParams as Omit<T, "usageMetadata"> };
}
