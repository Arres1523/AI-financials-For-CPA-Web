import type { Classification } from "./types";

export type ClassificationStatus = "classified" | "needs_classification" | "excluded";
export type DocumentationStatus = "complete" | "card_statements_needed" | "support_needed" | "cpa_review";

export function getClassificationStatus(c: Classification): ClassificationStatus {
  if (c.reviewStatus === "excluded") return "excluded";
  if (c.finalCategory?.includes("Uncategorized")) return "needs_classification";
  return "classified";
}

export function getDocumentationStatus(c: Classification): DocumentationStatus {
  if (c.reviewStatus === "card_statements_needed") return "card_statements_needed";
  if (c.reviewStatus === "support_needed") return "support_needed";
  if (c.reviewStatus === "cpa_review") return "cpa_review";
  return "complete";
}
