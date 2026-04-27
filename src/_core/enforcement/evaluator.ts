import { getLogger } from "../config/manager.js";
import { CostLimitExceeded } from "../resilience/error-handler.js";
import { findMatchingRules } from "./cache.js";

export interface EnforcementCriteria {
  subscriberId?: string;
  productName?: string;
  model?: string;
  provider?: string;
}

export function enforcePreCallRules(criteria: EnforcementCriteria): void {
  const logger = getLogger();
  const rules = findMatchingRules(criteria);

  if (rules.length === 0) {
    return;
  }

  for (const rule of rules) {
    if (!rule.breached) continue;

    // Log-only branches: shadowMode dampens any action, and WARN_ONLY /
    // THROTTLE are not client-side-enforceable today (THROTTLE would require
    // a delay primitive). Log them for visibility; the server handles
    // throttling out-of-band.
    if (rule.shadowMode || rule.action === "WARN_ONLY" || rule.action === "THROTTLE") {
      logger.warn("Cost limit rule breached (observation only)", {
        ruleId: rule.ruleId,
        threshold: rule.threshold,
        currentValue: rule.currentValue,
        periodType: rule.periodType,
        action: rule.action,
        shadowMode: rule.shadowMode,
        subscriberId: criteria.subscriberId,
      });
      continue;
    }

    if (rule.action === "BLOCK") {
      throw new CostLimitExceeded(
        String(rule.ruleId),
        rule.threshold,
        rule.currentValue,
        rule.periodType,
        {
          subscriberId: criteria.subscriberId,
          productName: criteria.productName,
          model: criteria.model,
          provider: criteria.provider,
        },
      );
    }
  }
}
