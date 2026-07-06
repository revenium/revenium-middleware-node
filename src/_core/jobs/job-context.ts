import { AsyncLocalStorage } from "async_hooks";
import { getConfig, getLogger } from "../config/manager.js";
import { ENV_VARS } from "../constants.js";
import { reportJobOutcome, amendJobOutcome } from "./job-api-client.js";
import type { JobOutcome, JobOutcomeAmendment, JobResource } from "../types/jobs.js";

export interface JobContextData {
  agenticJobId?: string;
  agenticJobName?: string;
  agenticJobType?: string;
  agenticJobVersion?: string;
}

const contextStorage = new AsyncLocalStorage<JobContextData>();

export function setJobContext(ctx: JobContextData): void {
  const current = contextStorage.getStore() ?? {};
  contextStorage.enterWith({ ...current, ...ctx });
}

export function getJobContext(): JobContextData {
  return contextStorage.getStore() ?? {};
}

export function clearJobContext(): void {
  contextStorage.enterWith({});
}

export function runWithJobContext<T>(
  ctx: JobContextData,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  const merged = { ...getJobContext(), ...ctx };
  return contextStorage.run(merged, fn);
}

export interface JobContextOptions {
  jobId: string;
  name?: string;
  type?: string;
  version?: string;
  teamId?: string;
}

export class JobContext {
  private readonly jobId: string;
  private readonly name?: string;
  private readonly type?: string;
  private readonly version?: string;
  private readonly teamId: string;

  constructor(options: JobContextOptions) {
    this.jobId = options.jobId;
    this.name = options.name;
    this.type = options.type;
    this.version = options.version;
    this.teamId = this.resolveTeamId(options.teamId);
  }

  start(): void {
    setJobContext(this.buildContextData());
  }

  end(): void {
    clearJobContext();
  }

  async run<T>(fn: () => T | Promise<T>): Promise<T> {
    return contextStorage.run(this.buildContextData(), async () => {
      try {
        return await fn();
      } catch (error) {
        await this.reportOutcome({ executionStatus: "FAILED" }).catch((reportError) => {
          getLogger().warn("Failed to auto-report FAILED outcome", { error: reportError });
        });
        throw error;
      }
    });
  }

  async reportOutcome(outcome: JobOutcome): Promise<JobResource> {
    return reportJobOutcome(this.jobId, outcome, this.teamId);
  }

  async amendOutcome(amendment: JobOutcomeAmendment): Promise<JobResource> {
    return amendJobOutcome(this.jobId, amendment, this.teamId);
  }

  private buildContextData(): JobContextData {
    const data: JobContextData = { agenticJobId: this.jobId };
    if (this.name) data.agenticJobName = this.name;
    if (this.type) data.agenticJobType = this.type;
    if (this.version) data.agenticJobVersion = this.version;
    return data;
  }

  private resolveTeamId(paramTeamId?: string): string {
    if (paramTeamId) return paramTeamId;

    const config = getConfig();
    if (config?.reveniumTeamId) return config.reveniumTeamId;

    const envTeamId = process.env[ENV_VARS.TEAM_ID];
    if (envTeamId) return envTeamId;

    throw new Error(
      "teamId is required: provide it as a parameter, set it in config, or set REVENIUM_TEAM_ID environment variable",
    );
  }
}
