import type { ReviewStatus } from "./types";

export const REVIEW_REQUIRED_STATUSES: ReviewStatus[] = [
  "pending",
  "support_needed",
  "cpa_review",
  "card_statements_needed",
];

export function requiresReview(classification: { reviewStatus: ReviewStatus } | null | undefined): boolean {
  if (!classification) return false;
  return REVIEW_REQUIRED_STATUSES.includes(classification.reviewStatus);
}

export function isApprovedForReporting(classification: { reviewStatus: ReviewStatus } | null | undefined): boolean {
  if (!classification) return false;
  return classification.reviewStatus === "approved";
}

export function isExcluded(classification: { reviewStatus: ReviewStatus } | null | undefined): boolean {
  if (!classification) return false;
  return classification.reviewStatus === "excluded";
}
