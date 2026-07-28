import { describe, expect, it } from "vitest";
import { applyCompanyClassificationRules, buildRulePatternFromText } from "../../src/domain/classificationRules";
import { classifyTransaction } from "../../src/domain/classification";
import type { CompanyClassificationRule, Transaction } from "../../src/domain/types";

const tx = (description: string, amount: number): Transaction => ({
  id: "tx-1",
  workspaceId: "ws-1",
  bankAccountId: "ba-1",
  statementId: "st-1",
  date: "2026-01-05",
  description,
  amount,
  balance: null,
  originalRowIndex: 0,
  createdAt: "2026-01-05T00:00:00.000Z",
});

describe("classificationRules", () => {
  const rules: CompanyClassificationRule[] = [{
    id: "rule-1",
    companyId: "company-1",
    pattern: "ACME MANAGEMENT",
    direction: "out",
    finalCategory: "Management Fees",
    reportType: "P&L",
    priority: 10,
    createdAt: "2026-01-01T00:00:00.000Z",
  }];

  it("suggests company rule categories without auto-approving them", () => {
    const base = classifyTransaction(tx("ACH ACME MANAGEMENT monthly fee", -250));
    const result = applyCompanyClassificationRules(base, tx("ACH ACME MANAGEMENT monthly fee", -250), rules);

    expect(result).toMatchObject({
      finalCategory: "Management Fees",
      reportType: "P&L",
      confidence: "medium",
      reviewStatus: "pending",
      isManualCorrection: false,
      ruleUsed: "Company rule — ACME MANAGEMENT",
    });
  });

  it("does not apply outgoing rules to incoming transactions", () => {
    const base = classifyTransaction(tx("ACH ACME MANAGEMENT refund", 250));
    const result = applyCompanyClassificationRules(base, tx("ACH ACME MANAGEMENT refund", 250), rules);

    expect(result.finalCategory).toBe(base.finalCategory);
    expect(result.ruleUsed).toBe(base.ruleUsed);
  });

  it("builds a reusable uppercase pattern from corrected text", () => {
    expect(buildRulePatternFromText("  Zoom.us Software Subscription  ")).toBe("ZOOM.US SOFTWARE SUBSCRIPTION");
  });
});
