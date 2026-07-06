import { createReveniumConfig, createMockFetch } from "../../helpers/fixtures";
import type { JobResource } from "../../../src/_core/types/jobs";

let setJobContext: typeof import("../../../src/_core/jobs/job-context").setJobContext;
let getJobContext: typeof import("../../../src/_core/jobs/job-context").getJobContext;
let clearJobContext: typeof import("../../../src/_core/jobs/job-context").clearJobContext;
let runWithJobContext: typeof import("../../../src/_core/jobs/job-context").runWithJobContext;
let JobContext: typeof import("../../../src/_core/jobs/job-context").JobContext;
let setConfig: typeof import("../../../src/_core/config/manager").setConfig;
let resetConfig: typeof import("../../../src/_core/config/manager").resetConfig;

const mockJobResource: JobResource = {
  id: "res-1",
  label: "Job job-123",
  resourceType: "JOB",
  agenticJobId: "job-123",
  source: "SDK",
  hasOutcome: true,
  executionStatus: "SUCCESS",
  outcomeType: "CONVERTED",
  outcomeValue: 99.5,
  outcomeCurrency: "USD",
};

const originalFetch = global.fetch;

beforeEach(async () => {
  jest.resetModules();
  const ctx = await import("../../../src/_core/jobs/job-context");
  const manager = await import("../../../src/_core/config/manager");
  setJobContext = ctx.setJobContext;
  getJobContext = ctx.getJobContext;
  clearJobContext = ctx.clearJobContext;
  runWithJobContext = ctx.runWithJobContext;
  JobContext = ctx.JobContext;
  setConfig = manager.setConfig;
  resetConfig = manager.resetConfig;
});

afterEach(() => {
  clearJobContext();
  resetConfig();
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe("job context storage", () => {
  it("getJobContext returns empty object by default", () => {
    expect(getJobContext()).toEqual({});
  });

  it("setJobContext stores values", () => {
    setJobContext({ agenticJobId: "job-1", agenticJobName: "test-job" });
    const ctx = getJobContext();
    expect(ctx.agenticJobId).toBe("job-1");
    expect(ctx.agenticJobName).toBe("test-job");
  });

  it("setJobContext merges with existing", () => {
    setJobContext({ agenticJobId: "job-1" });
    setJobContext({ agenticJobName: "test-job" });
    const ctx = getJobContext();
    expect(ctx.agenticJobId).toBe("job-1");
    expect(ctx.agenticJobName).toBe("test-job");
  });

  it("clearJobContext resets to empty", () => {
    setJobContext({ agenticJobId: "job-1" });
    clearJobContext();
    expect(getJobContext()).toEqual({});
  });

  it("runWithJobContext provides scoped context", async () => {
    setJobContext({ agenticJobId: "outer" });

    const inner = await runWithJobContext({ agenticJobId: "inner", agenticJobName: "scoped" }, () =>
      getJobContext(),
    );

    expect(inner.agenticJobId).toBe("inner");
    expect(inner.agenticJobName).toBe("scoped");
  });

  it("runWithJobContext works with async functions", async () => {
    const result = await runWithJobContext({ agenticJobId: "async-job" }, async () => {
      await new Promise((r) => setTimeout(r, 1));
      return getJobContext();
    });
    expect(result.agenticJobId).toBe("async-job");
  });

  it("async contexts are isolated", async () => {
    const results: string[] = [];

    const p1 = runWithJobContext({ agenticJobId: "a" }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      results.push(getJobContext().agenticJobId!);
    });

    const p2 = runWithJobContext({ agenticJobId: "b" }, async () => {
      results.push(getJobContext().agenticJobId!);
    });

    await Promise.all([p1, p2]);
    expect(results).toContain("a");
    expect(results).toContain("b");
  });
});

describe("JobContext class", () => {
  it("start sets job context and end clears it", () => {
    setConfig(createReveniumConfig({ reveniumTeamId: "team-1" }));
    const ctx = new JobContext({ jobId: "job-1", name: "my-job", type: "SUPPORT", version: "2.0" });

    ctx.start();
    const active = getJobContext();
    expect(active.agenticJobId).toBe("job-1");
    expect(active.agenticJobName).toBe("my-job");
    expect(active.agenticJobType).toBe("SUPPORT");
    expect(active.agenticJobVersion).toBe("2.0");

    ctx.end();
    expect(getJobContext()).toEqual({});
  });

  it("run scopes context and returns result", async () => {
    setConfig(createReveniumConfig({ reveniumTeamId: "team-1" }));
    const ctx = new JobContext({ jobId: "job-run", name: "runner" });

    const result = await ctx.run(() => {
      const active = getJobContext();
      return { id: active.agenticJobId, name: active.agenticJobName };
    });

    expect(result).toEqual({ id: "job-run", name: "runner" });
  });

  it("run auto-reports FAILED on unhandled exception", async () => {
    setConfig(createReveniumConfig({ reveniumTeamId: "team-1" }));
    const mockFetch = createMockFetch({ json: () => Promise.resolve(mockJobResource) });
    global.fetch = mockFetch;

    const ctx = new JobContext({ jobId: "job-fail" });

    await expect(
      ctx.run(() => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ executionStatus: "FAILED" });
  });

  it("run re-throws the original error after reporting", async () => {
    setConfig(createReveniumConfig({ reveniumTeamId: "team-1" }));
    global.fetch = createMockFetch({ json: () => Promise.resolve(mockJobResource) });

    const ctx = new JobContext({ jobId: "job-err" });
    const error = new Error("original");

    await expect(
      ctx.run(() => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  it("run swallows report failure on auto-FAILED", async () => {
    jest.useFakeTimers();
    setConfig(createReveniumConfig({ reveniumTeamId: "team-1" }));
    global.fetch = jest.fn(() => Promise.reject(new Error("network")));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();

    const ctx = new JobContext({ jobId: "job-net" });

    const promise = ctx.run(() => {
      throw new Error("boom");
    });

    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      jest.advanceTimersByTime(10_000);
    }

    await expect(promise).rejects.toThrow("boom");

    warnSpy.mockRestore();
    jest.useRealTimers();
  });

  it("reportOutcome calls API with resolved teamId", async () => {
    setConfig(createReveniumConfig({ reveniumTeamId: "team-1" }));
    const mockFetch = createMockFetch({ json: () => Promise.resolve(mockJobResource) });
    global.fetch = mockFetch;

    const ctx = new JobContext({ jobId: "job-report" });
    await ctx.reportOutcome({
      executionStatus: "SUCCESS",
      outcomeType: "CONVERTED",
      outcomeValue: 50,
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("teamId=team-1");
    expect(url).toContain("/job-report/outcome");
    expect(JSON.parse(options.body).executionStatus).toBe("SUCCESS");
  });

  it("uses constructor teamId over config teamId", async () => {
    setConfig(createReveniumConfig({ reveniumTeamId: "config-team" }));
    const mockFetch = createMockFetch({ json: () => Promise.resolve(mockJobResource) });
    global.fetch = mockFetch;

    const ctx = new JobContext({ jobId: "job-1", teamId: "param-team" });
    await ctx.reportOutcome({ executionStatus: "SUCCESS" });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("teamId=param-team");
  });

  it("resolves teamId from REVENIUM_TEAM_ID env var", () => {
    process.env.REVENIUM_TEAM_ID = "env-team";
    setConfig(createReveniumConfig());

    const ctx = new JobContext({ jobId: "job-env" });
    expect(ctx).toBeDefined();

    delete process.env.REVENIUM_TEAM_ID;
  });

  it("throws when teamId cannot be resolved", () => {
    setConfig(createReveniumConfig());
    delete process.env.REVENIUM_TEAM_ID;

    expect(() => new JobContext({ jobId: "job-no-team" })).toThrow("teamId is required");
  });

  it("run auto-reports FAILED on async rejection", async () => {
    setConfig(createReveniumConfig({ reveniumTeamId: "team-1" }));
    const mockFetch = createMockFetch({ json: () => Promise.resolve(mockJobResource) });
    global.fetch = mockFetch;

    const ctx = new JobContext({ jobId: "job-async-fail" });

    await expect(
      ctx.run(async () => {
        await new Promise((r) => setTimeout(r, 1));
        throw new Error("async boom");
      }),
    ).rejects.toThrow("async boom");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ executionStatus: "FAILED" });
  });

  it("start does not set undefined optional fields in context", () => {
    setConfig(createReveniumConfig({ reveniumTeamId: "team-1" }));
    const ctx = new JobContext({ jobId: "job-minimal" });

    ctx.start();
    const active = getJobContext();

    expect(active.agenticJobId).toBe("job-minimal");
    expect(active).not.toHaveProperty("agenticJobName");
    expect(active).not.toHaveProperty("agenticJobType");
    expect(active).not.toHaveProperty("agenticJobVersion");
  });
});
