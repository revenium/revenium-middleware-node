import { getConfig, getLogger } from "../config/manager.js";
import { DEFAULT_REVENIUM_BASE_URL, DEFAULT_CONFIG, ENFORCEMENT_CONFIG } from "../constants.js";
import { executeWithCircuitBreaker } from "../resilience/circuit-breaker.js";
import { EnforcementRule, setRules, clearCache } from "./cache.js";

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let warnedMissingTeamId = false;

export function buildEnforcementRulesUrl(baseUrl: string, reveniumTeamId: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  return `${normalizedBase}/v2/api/ai/enforcement-rules/${encodeURIComponent(reveniumTeamId)}`;
}

const ACTIONS: ReadonlySet<string> = new Set(["BLOCK", "THROTTLE", "WARN_ONLY"]);
const PERIODS: ReadonlySet<string> = new Set(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"]);

function toNumber(v: unknown): number | null {
  // Jackson BigDecimal serialization can flip between number and string
  // (`WRITE_BIGDECIMAL_AS_PLAIN`). Accept both.
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function parseEnforcementRulesResponse(data: unknown): EnforcementRule[] {
  // Server shape is `{ rules: [...] }`; accept a bare array too for forward compatibility.
  const raw: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { rules?: unknown[] } | null)?.rules)
      ? (data as { rules: unknown[] }).rules
      : [];

  const parsed: EnforcementRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;

    const ruleId = s.ruleId;
    const threshold = toNumber(s.threshold);
    const currentValue = toNumber(s.currentValue);
    const action = s.action;
    const periodType = s.periodType;
    const breached = s.breached;

    if (
      typeof ruleId !== "number" ||
      threshold === null ||
      currentValue === null ||
      typeof action !== "string" ||
      !ACTIONS.has(action) ||
      typeof periodType !== "string" ||
      !PERIODS.has(periodType) ||
      typeof breached !== "boolean"
    ) {
      continue;
    }

    parsed.push({
      ruleId,
      name: typeof s.name === "string" ? s.name : undefined,
      threshold,
      currentValue,
      periodType: periodType as EnforcementRule["periodType"],
      action: action as EnforcementRule["action"],
      breached,
      shadowMode: typeof s.shadowMode === "boolean" ? s.shadowMode : false,
    });
  }
  return parsed;
}

export function startEnforcementPolling(): void {
  const logger = getLogger();

  if (pollTimer) {
    logger.debug("Enforcement polling already running");
    return;
  }

  // Fetch immediately, then schedule next poll
  fetchRules().catch((error) => {
    logger.warn("Initial enforcement rules fetch failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  scheduleNextPoll();

  logger.debug("Enforcement polling started", {
    intervalMs: ENFORCEMENT_CONFIG.POLL_INTERVAL,
  });
}

export function stopEnforcementPolling(): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
    clearCache();
    warnedMissingTeamId = false;
    getLogger().debug("Enforcement polling stopped");
  }
}

export function isPolling(): boolean {
  return pollTimer !== null;
}

function scheduleNextPoll(): void {
  // Add +-20% jitter to avoid thundering herd
  const jitter = ENFORCEMENT_CONFIG.POLL_INTERVAL * 0.2 * (Math.random() * 2 - 1);
  const delay = ENFORCEMENT_CONFIG.POLL_INTERVAL + jitter;

  pollTimer = setTimeout(() => {
    fetchRules()
      .catch((error) => {
        getLogger().warn("Enforcement rules poll failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        if (pollTimer !== null) {
          scheduleNextPoll();
        }
      });
  }, delay);

  // Allow the process to exit even if the timer is running
  if (pollTimer && typeof pollTimer === "object" && "unref" in pollTimer) {
    pollTimer.unref();
  }
}

async function fetchRules(): Promise<void> {
  const config = getConfig();
  const logger = getLogger();

  if (!config) {
    logger.debug("No config available, skipping enforcement rules fetch");
    return;
  }

  if (!config.reveniumTeamId) {
    if (!warnedMissingTeamId) {
      warnedMissingTeamId = true;
      logger.warn("reveniumTeamId not set (env REVENIUM_TEAM_ID); enforcement rules fetch skipped");
    }
    return;
  }

  const enforcementBase =
    config.reveniumEnforcementBaseUrl || config.reveniumBaseUrl || DEFAULT_REVENIUM_BASE_URL;
  const url = buildEnforcementRulesUrl(enforcementBase, config.reveniumTeamId);

  logger.debug("Fetching enforcement rules", { url });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_CONFIG.API_TIMEOUT);

  try {
    await executeWithCircuitBreaker(async () => {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-api-key": config.reveniumApiKey,
        },
        signal: controller.signal,
      });

      if (response.status === 204) {
        setRules([]);
        logger.debug("Enforcement rules: no rules configured (204)");
        return;
      }

      if (!response.ok) {
        throw new Error(`Enforcement rules API error: ${response.status} ${response.statusText}`);
      }

      const data: unknown = await response.json();
      const rules = parseEnforcementRulesResponse(data);
      setRules(rules);
      logger.debug("Enforcement rules updated", { ruleCount: rules.length });
    });
  } finally {
    clearTimeout(timeout);
  }
}
