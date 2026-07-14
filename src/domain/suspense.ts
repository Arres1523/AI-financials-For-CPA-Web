import type { Classification, SuspenseItem, ReviewStatus } from "./types";
import { REVIEW_REQUIRED_STATUSES } from "./reviewPolicy";

export function buildSuspenseList(classifications: Classification[]): SuspenseItem[] {
  return classifications
    .filter(c => {
      if (c.reviewStatus === "approved" || c.reviewStatus === "excluded") return false;
      if (c.finalCategory?.includes("Uncategorized")) return true;
      return REVIEW_REQUIRED_STATUSES.includes(c.reviewStatus);
    })
    .map(c => ({
      transactionId: c.transactionId,
      date: "",
      description: "",
      amount: 0,
      currentCategory: c.finalCategory ?? "Unknown",
      reviewStatus: c.reviewStatus,
      reason: c.finalCategory?.includes("Uncategorized") ? `Uncategorized: ${c.finalCategory}` : (c.ruleUsed ?? `Status: ${c.reviewStatus}`),
    }));
}
