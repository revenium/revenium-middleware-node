import {
  setToolContext,
  getToolContext,
  clearToolContext,
  runWithToolContext,
} from "../../../src/_core/tool-metering/tool-context";

describe("tool-context", () => {
  afterEach(() => {
    clearToolContext();
  });

  it("getToolContext returns empty object by default", () => {
    expect(getToolContext()).toEqual({});
  });

  it("setToolContext stores values", () => {
    setToolContext({ agent: "my-agent", organizationName: "Acme" });
    const ctx = getToolContext();
    expect(ctx.agent).toBe("my-agent");
    expect(ctx.organizationName).toBe("Acme");
  });

  it("setToolContext merges with existing", () => {
    setToolContext({ agent: "agent-1" });
    setToolContext({ organizationName: "Corp" });
    const ctx = getToolContext();
    expect(ctx.agent).toBe("agent-1");
    expect(ctx.organizationName).toBe("Corp");
  });

  it("clearToolContext resets to empty", () => {
    setToolContext({ agent: "x" });
    clearToolContext();
    expect(getToolContext()).toEqual({});
  });

  it("runWithToolContext provides scoped context", async () => {
    setToolContext({ agent: "outer" });

    const inner = await runWithToolContext({ agent: "inner", productName: "prod" }, () =>
      getToolContext(),
    );

    expect(inner.agent).toBe("inner");
    expect(inner.productName).toBe("prod");
  });

  it("runWithToolContext works with async functions", async () => {
    const result = await runWithToolContext({ traceId: "trace-123" }, async () => {
      await new Promise((r) => setTimeout(r, 1));
      return getToolContext();
    });
    expect(result.traceId).toBe("trace-123");
  });

  it("async contexts are isolated", async () => {
    const results: string[] = [];

    const p1 = runWithToolContext({ agent: "a" }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      results.push(getToolContext().agent!);
    });

    const p2 = runWithToolContext({ agent: "b" }, async () => {
      results.push(getToolContext().agent!);
    });

    await Promise.all([p1, p2]);
    expect(results).toContain("a");
    expect(results).toContain("b");
  });
});
