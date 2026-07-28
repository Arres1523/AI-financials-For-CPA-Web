import { CATEGORY_OPTIONS } from "./categoryOptions";
import type { Classification, CompanyClassificationRule, Transaction } from "./types";

export function buildRulePatternFromText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toUpperCase();
}

export function applyCompanyClassificationRules(
  base: Classification,
  transaction: Transaction,
  rules: CompanyClassificationRule[]
): Classification {
  const text = transaction.description.toUpperCase();
  const direction = transaction.amount < 0 ? "out" : transaction.amount > 0 ? "in" : "any";
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  const match = sorted.find((rule) => {
    const ruleDirectionMatches = rule.direction === "any" || rule.direction === direction;
    return ruleDirectionMatches && text.includes(rule.pattern.toUpperCase());
  });

  if (!match) return base;

  const option = CATEGORY_OPTIONS.find((item) => item.value === match.finalCategory);
  if (!option) return base;

  return {
    ...base,
    finalCategory: option.value,
    reportType: option.reportType,
    confidence: "medium",
    ruleUsed: `Company rule — ${match.pattern}`,
    reviewStatus: "pending",
    isManualCorrection: false,
    updatedAt: new Date().toISOString(),
  };
}
