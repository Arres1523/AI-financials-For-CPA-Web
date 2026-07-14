import { describe, expect, it } from "vitest";
import { buildReports } from "../../src/domain/reporting";
import type { TransactionWithClassification } from "../../src/domain/types";

describe("buildReports", () => {
  function make(
    id: string,
    description: string,
    amount: number,
    category: string,
    reportType: "P&L" | "Balance Sheet"
  ): TransactionWithClassification {
    return {
      id,
      workspaceId: "ws-1",
      bankAccountId: "ba-1",
      statementId: "st-1",
      date: "2025-01-01",
      description,
      amount,
      balance: null,
      originalRowIndex: 0,
      createdAt: "2025-01-01T00:00:00.000Z",
      classification: {
        id: `c-${id}`,
        transactionId: id,
        finalCategory: category,
        reportType,
        confidence: "high" as const,
        ruleUsed: "test",
        reviewStatus: "approved" as const,
        isManualCorrection: false,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    };
  }

  it("keeps balance-sheet activity out of P&L", () => {
    const reports = buildReports("Demo LLC", 2025, [
      make("1", "Rent", 1000, "Rental Income", "P&L"),
      make("2", "Contribution", 5000, "Capital contributions", "Balance Sheet"),
    ]);
    expect(reports.pnl.netIncome).toBe(1000);
    expect(reports.balanceSheet.equity["Capital contributions"]).toBe(5000);
  });

  it("shows balance check when BS doesn't balance", () => {
    const reports = buildReports("Demo LLC", 2025, [
      make("1", "Income", 1000, "Rental Income", "P&L"),
    ]);
    expect(reports.balanceSheet.balanceCheck).not.toBe(0);
  });

  it("excludes Uncategorized / Needs Review from reports", () => {
    const reports = buildReports("Demo LLC", 2025, [
      make("1", "Unknown", -500, "Uncategorized / Needs Review", "Balance Sheet"),
      make("2", "Rent", 1000, "Rental Income", "P&L"),
    ]);
    expect(reports.pnl.netIncome).toBe(1000);
    expect(reports.balanceSheet.assets).not.toHaveProperty("Uncategorized / Needs Review");
    expect(reports.balanceSheet.liabilities).not.toHaveProperty("Uncategorized / Needs Review");
    expect(reports.balanceSheet.equity).not.toHaveProperty("Uncategorized / Needs Review");
  });

  it("shows P&L expenses as positive amounts", () => {
    const reports = buildReports("Demo LLC", 2025, [
      make("1", "Bank fee", -35, "Bank Fees", "P&L"),
      make("2", "Rent", 1000, "Rental Income", "P&L"),
    ]);
    expect(reports.pnl.income["Rental Income"]).toBe(1000);
    expect(reports.pnl.expenses["Bank Fees"]).toBe(35);
    expect(reports.pnl.netIncome).toBe(965);
  });

  it("classifies new category names into correct BS sections", () => {
    const reports = buildReports("Demo LLC", 2025, [
      make("1", "Contribution", 5000, "Capital contributions", "Balance Sheet"),
      make("2", "Distribution", -2000, "Member distributions", "Balance Sheet"),
      make("3", "CC payment", -100, "Credit card payable", "Balance Sheet"),
      make("4", "Due to", 3000, "Due to related parties", "Balance Sheet"),
    ]);
    expect(reports.balanceSheet.equity["Capital contributions"]).toBe(5000);
    expect(reports.balanceSheet.equity["Member distributions"]).toBe(-2000);
    expect(reports.balanceSheet.liabilities["Credit card payable"]).toBe(-100);
    expect(reports.balanceSheet.liabilities["Due to related parties"]).toBe(3000);
  });
});
