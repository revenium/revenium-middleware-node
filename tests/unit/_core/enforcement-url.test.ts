import { buildEnforcementRulesUrl } from "../../../src/_core/enforcement/engine";

describe("buildEnforcementRulesUrl", () => {
  it("appends the enforcement path directly to the configured base", () => {
    expect(buildEnforcementRulesUrl("https://api.revenium.ai", "HASHED_ID")).toBe(
      "https://api.revenium.ai/v2/api/ai/enforcement-rules/HASHED_ID",
    );
  });

  it("preserves a servlet context path like /profitstream", () => {
    expect(buildEnforcementRulesUrl("http://localhost:8080/profitstream", "Ol3wbl")).toBe(
      "http://localhost:8080/profitstream/v2/api/ai/enforcement-rules/Ol3wbl",
    );
  });

  it("strips trailing slashes from the base URL", () => {
    expect(buildEnforcementRulesUrl("http://localhost:8080/profitstream///", "abc")).toBe(
      "http://localhost:8080/profitstream/v2/api/ai/enforcement-rules/abc",
    );
  });

  it("url-encodes the team id", () => {
    expect(buildEnforcementRulesUrl("https://api.revenium.ai", "a/b+c")).toBe(
      "https://api.revenium.ai/v2/api/ai/enforcement-rules/a%2Fb%2Bc",
    );
  });
});
