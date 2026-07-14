import { describe, expect, it } from "vitest";
import { buildSuspenseList } from "../../src/domain/suspense";
import type { Classification } from "../../src/domain/types";

const mk = (id: string, status: string, category?: string): Classification => ({
  id: `c-${id}`,
  transactionId: id,
  finalCategory: category ?? "Rental Income",
  reportType: "P&L",
  confidence: "high",
  ruleUsed: "test",
  reviewStatus: status as any,
  isManualCorrection: false,
  createdAt: "",
  updatedAt: "",
});

describe("buildSuspenseList", () => {
  it("returns empty when all approved", () => {
    expect(buildSuspenseList([mk("1", "approved"), mk("2", "excluded")])).toHaveLength(0);
  });

  it("flags Uncategorized / Needs Review", () => {
    const result = buildSuspenseList([mk("1", "pending", "Uncategorized / Needs Review")]);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain("Uncategorized");
  });

  it("flags pending status", () => {
    const result = buildSuspenseList([mk("1", "pending")]);
    expect(result).toHaveLength(1);
  });

  it("flags support_needed status", () => {
    const result = buildSuspenseList([mk("1", "support_needed")]);
    expect(result).toHaveLength(1);
  });

  it("flags cpa_review status", () => {
    const result = buildSuspenseList([mk("1", "cpa_review")]);
    expect(result).toHaveLength(1);
  });

  it("flags card_statements_needed status", () => {
    const result = buildSuspenseList([mk("1", "card_statements_needed")]);
    expect(result).toHaveLength(1);
  });

  it("does not flag excluded", () => {
    const result = buildSuspenseList([mk("1", "excluded")]);
    expect(result).toHaveLength(0);
  });

  it("does not flag approved", () => {
    const result = buildSuspenseList([mk("1", "approved")]);
    expect(result).toHaveLength(0);
  });
});
