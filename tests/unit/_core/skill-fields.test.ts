import { createReveniumConfig, createMockFetch } from "../../helpers/fixtures";
import type { PayloadParams } from "../../../src/_core/metering/payload-builder";
import type { UsageMetadata } from "../../../src/_core/types/index";

let buildPayload: typeof import("../../../src/_core/metering/payload-builder").buildPayload;
let sendToRevenium: typeof import("../../../src/_core/metering/api-client").sendToRevenium;
let setConfig: typeof import("../../../src/_core/config/manager").setConfig;
let resetConfig: typeof import("../../../src/_core/config/manager").resetConfig;

const originalFetch = global.fetch;

const SKILL_WIRE_FIELDS = [
  "skillName",
  "skillSource",
  "skillKind",
  "skillPluginName",
  "skillMarketplaceName",
  "skillInvocationTrigger",
];

const SKILL_FIELD_CAPS: Record<string, number> = {
  skillName: 256,
  skillSource: 50,
  skillKind: 50,
  skillPluginName: 256,
  skillMarketplaceName: 256,
  skillInvocationTrigger: 32,
};

function metadataWithSkillValues(lengthFor: (cap: number) => number): UsageMetadata {
  const usageMetadata: Record<string, unknown> = {};
  for (const [field, cap] of Object.entries(SKILL_FIELD_CAPS)) {
    usageMetadata[field] = "x".repeat(lengthFor(cap));
  }
  return usageMetadata as UsageMetadata;
}

function createParams(usageMetadata?: UsageMetadata): PayloadParams {
  return {
    operationType: "CHAT",
    model: "claude-sonnet-4-20250514",
    startTime: Date.now() - 1000,
    duration: 1000,
    provider: "Anthropic",
    modelSource: "ANTHROPIC",
    middlewareSource: "revenium-anthropic-node",
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    stopReason: "end_turn",
    isStreamed: false,
    usageMetadata,
  };
}

async function meterCompletion(usageMetadata?: UsageMetadata): Promise<Record<string, unknown>> {
  const mockFetch = createMockFetch();
  global.fetch = mockFetch;

  await sendToRevenium(await buildPayload(createParams(usageMetadata)));

  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch.mock.calls[0][0]).toContain("/ai/completions");
  return JSON.parse(mockFetch.mock.calls[0][1].body);
}

beforeEach(async () => {
  jest.resetModules();
  process.env.AWS_REGION = "us-east-1";

  const manager = await import("../../../src/_core/config/manager");
  const payloadBuilder = await import("../../../src/_core/metering/payload-builder");
  const client = await import("../../../src/_core/metering/api-client");

  buildPayload = payloadBuilder.buildPayload;
  sendToRevenium = client.sendToRevenium;
  setConfig = manager.setConfig;
  resetConfig = manager.resetConfig;

  setConfig(createReveniumConfig());
});

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
  delete process.env.AWS_REGION;
  resetConfig();
});

describe("skill attribution on the completions body", () => {
  it("sends all six skill fields when set as camelCase in usageMetadata", async () => {
    const body = await meterCompletion({
      skillName: "quarterly-report",
      skillSource: "projectSettings",
      skillKind: "workflow",
      skillPluginName: "reporting-tools",
      skillMarketplaceName: "acme-marketplace",
      skillInvocationTrigger: "user-slash",
    });

    expect(body).toHaveProperty("skillName", "quarterly-report");
    expect(body).toHaveProperty("skillSource", "projectSettings");
    expect(body).toHaveProperty("skillKind", "workflow");
    expect(body).toHaveProperty("skillPluginName", "reporting-tools");
    expect(body).toHaveProperty("skillMarketplaceName", "acme-marketplace");
    expect(body).toHaveProperty("skillInvocationTrigger", "user-slash");
  });

  it("accepts the snake_case aliases and still writes camelCase to the wire", async () => {
    const body = await meterCompletion({
      skill_name: "quarterly-report",
      skill_source: "bundled",
      skill_kind: "workflow",
      skill_plugin_name: "reporting-tools",
      skill_marketplace_name: "acme-marketplace",
      skill_invocation_trigger: "claude-proactive",
    });

    expect(body).toHaveProperty("skillName", "quarterly-report");
    expect(body).toHaveProperty("skillSource", "bundled");
    expect(body).toHaveProperty("skillKind", "workflow");
    expect(body).toHaveProperty("skillPluginName", "reporting-tools");
    expect(body).toHaveProperty("skillMarketplaceName", "acme-marketplace");
    expect(body).toHaveProperty("skillInvocationTrigger", "claude-proactive");

    expect(body).not.toHaveProperty("skill_name");
    expect(body).not.toHaveProperty("skill_source");
    expect(body).not.toHaveProperty("skill_kind");
    expect(body).not.toHaveProperty("skill_plugin_name");
    expect(body).not.toHaveProperty("skill_marketplace_name");
    expect(body).not.toHaveProperty("skill_invocation_trigger");
  });

  it("prefers the camelCase field when both casings are set", async () => {
    const body = await meterCompletion({
      skill_name: "from-snake-case",
      skillName: "from-camel-case",
      skill_source: "bundled",
      skillSource: "userSettings",
    });

    expect(body).toHaveProperty("skillName", "from-camel-case");
    expect(body).toHaveProperty("skillSource", "userSettings");
  });

  it("sends only the skill fields the caller provided", async () => {
    const body = await meterCompletion({
      skillName: "quarterly-report",
      skillSource: "plugin",
      skillKind: "workflow",
    });

    expect(body).toHaveProperty("skillName", "quarterly-report");
    expect(body).toHaveProperty("skillSource", "plugin");
    expect(body).toHaveProperty("skillKind", "workflow");
    expect(body).not.toHaveProperty("skillPluginName");
    expect(body).not.toHaveProperty("skillMarketplaceName");
    expect(body).not.toHaveProperty("skillInvocationTrigger");
  });

  it("omits every skill field when other metadata is set but no skill is", async () => {
    const body = await meterCompletion({ taskType: "synthesis", traceId: "trace-001" });

    expect(body).toHaveProperty("taskType", "synthesis");
    for (const field of SKILL_WIRE_FIELDS) {
      expect(body).not.toHaveProperty(field);
    }
  });

  it("omits every skill field when no usageMetadata is provided", async () => {
    const body = await meterCompletion();

    for (const field of SKILL_WIRE_FIELDS) {
      expect(body).not.toHaveProperty(field);
    }
  });
});

describe("skill attribution length bounds", () => {
  it("truncates an overlong value to the exact cap for every skill field", async () => {
    const body = await meterCompletion(metadataWithSkillValues((cap) => cap + 100));

    for (const [field, cap] of Object.entries(SKILL_FIELD_CAPS)) {
      expect(body[field]).toBe("x".repeat(cap));
    }
  });

  it("passes a value exactly at the cap through unchanged", async () => {
    const body = await meterCompletion(metadataWithSkillValues((cap) => cap));

    for (const [field, cap] of Object.entries(SKILL_FIELD_CAPS)) {
      expect(body[field]).toBe("x".repeat(cap));
    }
  });

  it("leaves a value under the cap untouched", async () => {
    const body = await meterCompletion({
      skillName: "quarterly-report",
      skillInvocationTrigger: "user-slash",
    });

    expect(body).toHaveProperty("skillName", "quarterly-report");
    expect(body).toHaveProperty("skillInvocationTrigger", "user-slash");
  });

  it("truncates a value supplied through the snake_case alias", async () => {
    const body = await meterCompletion({
      skill_invocation_trigger: "t".repeat(SKILL_FIELD_CAPS.skillInvocationTrigger + 10),
    });

    expect(body).toHaveProperty(
      "skillInvocationTrigger",
      "t".repeat(SKILL_FIELD_CAPS.skillInvocationTrigger),
    );
  });
});
