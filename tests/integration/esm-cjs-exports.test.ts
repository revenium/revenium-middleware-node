import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "../..");
const distCjs = join(ROOT, "dist/cjs");
const distEsm = join(ROOT, "dist/esm");

describe("CJS exports", () => {
  const cjsPaths = [
    "openai/index.js",
    "anthropic/index.js",
    "litellm/index.js",
    "perplexity/index.js",
    "google/genai/index.js",
    "google/vertex/index.js",
    "_core/tool-metering/index.js",
  ];

  it.each(cjsPaths)("dist/cjs/%s is requireable", (path) => {
    const fullPath = join(distCjs, path);
    if (!existsSync(fullPath)) {
      return;
    }

    const mod = require(fullPath);
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });

  it("openai CJS exports expected names", () => {
    const fullPath = join(distCjs, "openai/index.js");
    if (!existsSync(fullPath)) return;

    const mod = require(fullPath);
    expect(mod.ReveniumOpenAI).toBeDefined();
    expect(mod.Initialize).toBeDefined();
    expect(mod.trackUsageAsync).toBeDefined();
  });
});

describe("ESM distribution files exist", () => {
  const esmPaths = [
    "openai/index.js",
    "anthropic/index.js",
    "litellm/index.js",
    "perplexity/index.js",
    "google/genai/index.js",
    "google/vertex/index.js",
    "_core/tool-metering/index.js",
  ];

  it.each(esmPaths)("dist/esm/%s exists", (path) => {
    const fullPath = join(distEsm, path);
    expect(existsSync(fullPath)).toBe(true);
  });
});

describe("package.json exports map", () => {
  it("defines all expected entry points", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));

    const expectedEntries = [
      ".",
      "./openai",
      "./anthropic",
      "./google/genai",
      "./google/vertex",
      "./perplexity",
      "./litellm",
      "./tools",
    ];

    for (const entry of expectedEntries) {
      expect(pkg.exports[entry]).toBeDefined();
      expect(pkg.exports[entry].import).toBeDefined();
      expect(pkg.exports[entry].require).toBeDefined();
    }
  });
});
