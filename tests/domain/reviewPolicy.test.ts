import { describe, expect, it } from "vitest";
import { requiresReview, isApprovedForReporting, isExcluded, REVIEW_REQUIRED_STATUSES } from "../../src/domain/reviewPolicy";

describe("requiresReview", () => {
  it("returns true for pending", () => {
    expect(requiresReview({ reviewStatus: "pending" })).toBe(true);
  });
  it("returns true for support_needed", () => {
    expect(requiresReview({ reviewStatus: "support_needed" })).toBe(true);
  });
  it("returns true for cpa_review", () => {
    expect(requiresReview({ reviewStatus: "cpa_review" })).toBe(true);
  });
  it("returns true for card_statements_needed", () => {
    expect(requiresReview({ reviewStatus: "card_statements_needed" })).toBe(true);
  });
  it("returns false for approved", () => {
    expect(requiresReview({ reviewStatus: "approved" })).toBe(false);
  });
  it("returns false for excluded", () => {
    expect(requiresReview({ reviewStatus: "excluded" })).toBe(false);
  });
  it("returns false for null", () => {
    expect(requiresReview(null)).toBe(false);
  });
});

describe("isApprovedForReporting", () => {
  it("returns true for approved", () => {
    expect(isApprovedForReporting({ reviewStatus: "approved" })).toBe(true);
  });
  it("returns false for pending", () => {
    expect(isApprovedForReporting({ reviewStatus: "pending" })).toBe(false);
  });
  it("returns false for null", () => {
    expect(isApprovedForReporting(null)).toBe(false);
  });
});

describe("isExcluded", () => {
  it("returns true for excluded", () => {
    expect(isExcluded({ reviewStatus: "excluded" })).toBe(true);
  });
  it("returns false for approved", () => {
    expect(isExcluded({ reviewStatus: "approved" })).toBe(false);
  });
  it("returns false for null", () => {
    expect(isExcluded(null)).toBe(false);
  });
});

describe("REVIEW_REQUIRED_STATUSES", () => {
  it("contains all non-terminal review statuses", () => {
    expect(REVIEW_REQUIRED_STATUSES).toEqual([
      "pending",
      "support_needed",
      "cpa_review",
      "card_statements_needed",
    ]);
  });
});
