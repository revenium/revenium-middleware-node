export type EnforcementAction = "BLOCK" | "THROTTLE" | "WARN_ONLY";
export type BudgetWindow = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";

// Field names mirror the server's CompiledEnforcementRule
// (hypercurrent#3877 / #3950) and isotope's apps/web/src/types/budgetRule.ts
// so the on-wire contract is identical across SDK + UI + backend.
export interface EnforcementRule {
  ruleId: number;
  name?: string;
  threshold: number;
  currentValue: number;
  periodType: BudgetWindow;
  action: EnforcementAction;
  breached: boolean;
  shadowMode: boolean;
  // Optional criteria flattened from server-side `filters`. The current parse
  // path does not populate these (no filter dimension extraction yet); the
  // fields exist so evaluator criteria can match if a future parse does.
  subscriberId?: string;
  productName?: string;
  model?: string;
  provider?: string;
}

const ruleCache = new Map<string, EnforcementRule[]>();
let lastUpdated: number | null = null;

export function getRules(): EnforcementRule[] {
  const all: EnforcementRule[] = [];
  for (const rules of ruleCache.values()) {
    all.push(...rules);
  }
  return all;
}

export function setRules(rules: EnforcementRule[]): void {
  ruleCache.clear();
  for (const rule of rules) {
    const key = buildKey(rule);
    const existing = ruleCache.get(key) || [];
    existing.push(rule);
    ruleCache.set(key, existing);
  }
  lastUpdated = Date.now();
}

export function findMatchingRules(criteria: {
  subscriberId?: string;
  productName?: string;
  model?: string;
  provider?: string;
}): EnforcementRule[] {
  const matches: EnforcementRule[] = [];

  for (const rules of ruleCache.values()) {
    for (const rule of rules) {
      if (ruleMatches(rule, criteria)) {
        matches.push(rule);
      }
    }
  }

  return matches;
}

export function getLastUpdated(): number | null {
  return lastUpdated;
}

export function clearCache(): void {
  ruleCache.clear();
  lastUpdated = null;
}

function buildKey(rule: EnforcementRule): string {
  return `${rule.ruleId}:${rule.subscriberId || "*"}:${rule.productName || "*"}`;
}

function ruleMatches(
  rule: EnforcementRule,
  criteria: {
    subscriberId?: string;
    productName?: string;
    model?: string;
    provider?: string;
  },
): boolean {
  if (rule.subscriberId && rule.subscriberId !== criteria.subscriberId) return false;
  if (rule.productName && rule.productName !== criteria.productName) return false;
  if (rule.model && rule.model !== criteria.model) return false;
  if (rule.provider && rule.provider !== criteria.provider) return false;
  return true;
}
