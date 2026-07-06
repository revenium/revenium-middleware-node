import { createReveniumConfig, createMockFetch } from "../helpers/fixtures";
import type { JobResource } from "../../src/_core/types/jobs";

let JobContext: typeof import("../../src/_core/jobs/job-context").JobContext;
let getJobContext: typeof import("../../src/_core/jobs/job-context").getJobContext;
let setJobContext: typeof import("../../src/_core/jobs/job-context").setJobContext;
let clearJobContext: typeof import("../../src/_core/jobs/job-context").clearJobContext;
let buildMetadataFields: typeof import("../../src/_core/metadata/metadata-builder").buildMetadataFields;
let setConfig: typeof import("../../src/_core/config/manager").setConfig;
let resetConfig: typeof import("../../src/_core/config/manager").resetConfig;

const mockJobResource: JobResource = {
  id: "res-1",
  label: "Job job-e2e",
  resourceType: "JOB",
  agenticJobId: "job-e2e",
  source: "SDK",
  hasOutcome: true,
};

const originalFetch = global.fetch;

beforeEach(async () => {
  jest.resetModules();
  delete process.env.REVENIUM_AGENTIC_JOB_ID;
  delete process.env.REVENIUM_AGENTIC_JOB_NAME;
  delete process.env.REVENIUM_AGENTIC_JOB_TYPE;
  delete process.env.REVENIUM_AGENTIC_JOB_VERSION;
  const ctx = await import("../../src/_core/jobs/job-context");
  const builder = await import("../../src/_core/metadata/metadata-builder");
  const manager = await import("../../src/_core/config/manager");
  JobContext = ctx.JobContext;
  getJobContext = ctx.getJobContext;
  setJobContext = ctx.setJobContext;
  clearJobContext = ctx.clearJobContext;
  buildMetadataFields = builder.buildMetadataFields;
  setConfig = manager.setConfig;
  resetConfig = manager.resetConfig;
});

afterEach(() => {
  clearJobContext();
  resetConfig();
  global.fetch = originalFetch;
  delete process.env.REVENIUM_AGENTIC_JOB_ID;
  delete process.env.REVENIUM_AGENTIC_JOB_NAME;
  delete process.env.REVENIUM_AGENTIC_JOB_TYPE;
  delete process.env.REVENIUM_AGENTIC_JOB_VERSION;
  jest.restoreAllMocks();
});

describe("JobContext full lifecycle", () => {
  it("run() scopes context -> buildMetadataFields picks it up -> reportOutcome works", async () => {
    setConfig(createReveniumConfig({ reveniumTeamId: "team-e2e" }));
    const mockFetch = createMockFetch({ json: () => Promise.resolve(mockJobResource) });
    global.fetch = mockFetch;

    const job = new JobContext({
      jobId: "job-e2e",
      name: "lead-qualification",
      type: "SALES",
      version: "1.0.0",
    });

    const result = await job.run(async () => {
      const metadata = buildMetadataFields({ traceId: "trace-abc", agent: "sales-bot" });

      expect(metadata.agenticJobId).toBe("job-e2e");
      expect(metadata.agenticJobName).toBe("lead-qualification");
      expect(metadata.agenticJobType).toBe("SALES");
      expect(metadata.agenticJobVersion).toBe("1.0.0");
      expect(metadata.traceId).toBe("trace-abc");
      expect(metadata.agent).toBe("sales-bot");

      await job.reportOutcome({
        executionStatus: "SUCCESS",
        outcomeType: "CONVERTED",
        outcomeValue: 150,
        outcomeCurrency: "USD",
      });

      return "completed";
    });

    expect(result).toBe("completed");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/job-e2e/outcome");
    expect(url).toContain("teamId=team-e2e");
    expect(JSON.parse(options.body).outcomeValue).toBe(150);
  });

  it("start/end lifecycle propagates to buildMetadataFields", () => {
    setConfig(createReveniumConfig({ reveniumTeamId: "team-1" }));
    const job = new JobContext({ jobId: "job-manual", name: "support-agent", type: "SUPPORT" });

    expect(buildMetadataFields()).toEqual({});

    job.start();

    const during = buildMetadataFields({ traceId: "t1" });
    expect(during.agenticJobId).toBe("job-manual");
    expect(during.agenticJobName).toBe("support-agent");
    expect(during.agenticJobType).toBe("SUPPORT");
    expect(during.traceId).toBe("t1");

    job.end();

    const after = buildMetadataFields({ traceId: "t2" });
    expect(after).not.toHaveProperty("agenticJobId");
    expect(after.traceId).toBe("t2");
  });

  it("env vars serve as fallback when no context or explicit metadata", () => {
    process.env.REVENIUM_AGENTIC_JOB_ID = "env-fallback-job";
    process.env.REVENIUM_AGENTIC_JOB_TYPE = "BATCH";

    const metadata = buildMetadataFields({ agent: "worker" });

    expect(metadata.agenticJobId).toBe("env-fallback-job");
    expect(metadata.agenticJobType).toBe("BATCH");
    expect(metadata.agent).toBe("worker");
  });

  it("concurrent jobs with run() have isolated contexts", async () => {
    setConfig(createReveniumConfig({ reveniumTeamId: "team-1" }));

    const jobA = new JobContext({ jobId: "job-A", name: "job-alpha" });
    const jobB = new JobContext({ jobId: "job-B", name: "job-beta" });

    const results: Record<string, string>[] = [];

    const pA = jobA.run(async () => {
      await new Promise((r) => setTimeout(r, 10));
      const meta = buildMetadataFields();
      results.push({ id: meta.agenticJobId as string, name: meta.agenticJobName as string });
    });

    const pB = jobB.run(async () => {
      const meta = buildMetadataFields();
      results.push({ id: meta.agenticJobId as string, name: meta.agenticJobName as string });
    });

    await Promise.all([pA, pB]);

    expect(results).toContainEqual({ id: "job-A", name: "job-alpha" });
    expect(results).toContainEqual({ id: "job-B", name: "job-beta" });
  });

  it("run() auto-reports FAILED then re-throws, context is clean after", async () => {
    setConfig(createReveniumConfig({ reveniumTeamId: "team-1" }));
    const mockFetch = createMockFetch({ json: () => Promise.resolve(mockJobResource) });
    global.fetch = mockFetch;

    const job = new JobContext({ jobId: "job-crash" });

    await expect(
      job.run(async () => {
        const ctx = getJobContext();
        expect(ctx.agenticJobId).toBe("job-crash");
        throw new Error("task failed");
      }),
    ).rejects.toThrow("task failed");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).executionStatus).toBe("FAILED");
  });

  it("explicit metadata wins over context and env in full chain", () => {
    setConfig(createReveniumConfig({ reveniumTeamId: "team-1" }));
    process.env.REVENIUM_AGENTIC_JOB_ID = "env-id";
    process.env.REVENIUM_AGENTIC_JOB_NAME = "env-name";
    process.env.REVENIUM_AGENTIC_JOB_TYPE = "env-type";
    process.env.REVENIUM_AGENTIC_JOB_VERSION = "env-version";

    setJobContext({ agenticJobId: "ctx-id", agenticJobName: "ctx-name" });

    const metadata = buildMetadataFields({
      agenticJobId: "explicit-id",
    });

    expect(metadata.agenticJobId).toBe("explicit-id");
    expect(metadata.agenticJobName).toBe("ctx-name");
    expect(metadata.agenticJobType).toBe("env-type");
    expect(metadata.agenticJobVersion).toBe("env-version");
  });
});
