import { describe, expect, it } from "vitest";
import { buildReports, buildBankReconciliation, buildClassificationCompleteness, buildAccountingEquation, determineFinancialReportMode, buildFinancialReport } from "../../src/domain/reporting";
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

  it("verifies full P&L and BS output with hand-calculated values", () => {
    const PnL = "P&L" as const;
    const BS = "Balance Sheet" as const;
    const reports = buildReports("Test LLC", 2025, [
      make("1", "Rent", 5000, "Rental Income", PnL),
      make("2", "Bank fee", -100, "Bank Fees", PnL),
      make("3", "Merchant fee", -25.5, "Merchant Processing Fees", PnL),
      make("4", "Transfer in", 2000, "Transfer Clearing", BS),
      make("5", "CC payment", -500, "Credit card payable", BS),
      make("6", "Cash in", 10000, "Capital contributions", BS),
      make("7", "Draw", -3000, "Member distributions", BS),
    ]);

    // P&L
    expect(reports.pnl.income).toEqual({ "Rental Income": 5000 });
    expect(reports.pnl.expenses).toEqual({ "Bank Fees": 100, "Merchant Processing Fees": 25.5 });
    expect(reports.pnl.netIncome).toBe(4874.5);

    // BS — assets (no liability/equity match → falls to assets)
    expect(reports.balanceSheet.assets).toEqual({ "Transfer Clearing": 2000 });

    // BS — liabilities (matches /payable|liability|Due To|Loan/i)
    expect(reports.balanceSheet.liabilities).toEqual({ "Credit card payable": -500 });

    // BS — equity (matches /contribution|distribution|net income/i)
    expect(reports.balanceSheet.equity).toEqual({
      "Capital contributions": 10000,
      "Member distributions": -3000,
      "Current Year Net Income": 4874.5,
    });

    // Balance Check = Assets - Liabilities - Equity
    // = 2000 - (-500) - (10000 + (-3000) + 4874.5)
    // = 2000 + 500 - 11874.5
    // = -9374.5
    expect(reports.balanceSheet.balanceCheck).toBe(-9374.5);
  });
});

describe("buildBankReconciliation", () => {
  it("returns reconciled when variance <= 0.01", () => {
    const result = buildBankReconciliation([
      { id: "a1", openingBalance: 1000, closingBalance: 1500, accountName: "Checking" },
    ], { a1: [{ amount: 500 } as any] });
    expect(result[0].status).toBe("reconciled");
    expect(result[0].variance).toBe(0);
  });

  it("returns unreconciled when variance > 0.01", () => {
    const result = buildBankReconciliation([
      { id: "a1", openingBalance: 1000, closingBalance: 1600, accountName: "Checking" },
    ], { a1: [{ amount: 500 } as any] });
    expect(result[0].status).toBe("unreconciled");
    expect(Math.abs(result[0].variance)).toBeGreaterThan(0.01);
  });

  it("handles multiple accounts", () => {
    const accounts = [
      { id: "a1", openingBalance: 1000, closingBalance: 1500, accountName: "Checking" },
      { id: "a2", openingBalance: 500, closingBalance: 400, accountName: "Savings" },
    ];
    const txByAcct = { a1: [{ amount: 500 } as any], a2: [{ amount: -100 } as any] };
    const result = buildBankReconciliation(accounts as any, txByAcct);
    expect(result).toHaveLength(2);
    expect(result.every(r => r.status === "reconciled")).toBe(true);
  });
});

describe("buildClassificationCompleteness", () => {
  const mkClass = (status: string, category?: string) => ({ reviewStatus: status, finalCategory: category ?? "Rental Income" }) as any;

  it("returns complete when all approved", () => {
    const result = buildClassificationCompleteness([
      mkClass("approved"), mkClass("approved"), mkClass("excluded"),
    ]);
    expect(result.status).toBe("complete");
    expect(result.unresolved).toBe(0);
  });

  it("returns incomplete when any pending or unresolved", () => {
    const result = buildClassificationCompleteness([
      mkClass("approved"), mkClass("pending"),
    ]);
    expect(result.status).toBe("incomplete");
    expect(result.unresolved).toBe(1);
  });

  it("counts suspense for Uncategorized", () => {
    const result = buildClassificationCompleteness([
      mkClass("pending", "Uncategorized / Needs Review"),
    ]);
    expect(result.suspenseAmount).toBe(0);
    expect(result.status).toBe("incomplete");
  });
});

describe("buildAccountingEquation", () => {
  it("passes when difference is 0 and all inputs present", () => {
    const result = buildAccountingEquation(1000, 300, 700, true, false, false);
    expect(result.status).toBe("passed");
    expect(result.difference).toBe(0);
  });

  it("fails when difference != 0 and all inputs present", () => {
    const result = buildAccountingEquation(1000, 300, 600, true, false, false);
    expect(result.status).toBe("failed");
    expect(result.difference).toBe(100);
  });

  it("returns incomplete_data when opening balances missing", () => {
    const result = buildAccountingEquation(1000, 300, 700, false, false, false);
    expect(result.status).toBe("incomplete_data");
    expect(result.missingInputs).toContain("Opening Balance Sheet not provided");
  });

  it("returns incomplete_data when suspense exists", () => {
    const result = buildAccountingEquation(1000, 300, 700, true, true, false);
    expect(result.status).toBe("incomplete_data");
    expect(result.missingInputs).toContain("Unresolved suspense entries");
  });

  it("returns incomplete_data when card statements needed", () => {
    const result = buildAccountingEquation(1000, 300, 700, true, false, true);
    expect(result.status).toBe("incomplete_data");
    expect(result.missingInputs).toContain("Credit card statements not imported");
  });

  it("difference zero with incomplete data still returns incomplete_data", () => {
    const result = buildAccountingEquation(1000, 300, 700, false, false, false);
    expect(result.status).toBe("incomplete_data");
  });
});

describe("buildFinancialReport", () => {
  it("reports matched transfer count and amount", () => {
    const accounts = [
      { id: "a1", openingBalance: 1000, closingBalance: 1500, accountName: "Checking", companyId: "c1" },
      { id: "a2", openingBalance: 500, closingBalance: 1000, accountName: "Savings", companyId: "c1" },
    ];
    const transactions = [
      { id: "t1", amount: -500, bankAccountId: "a1", companyId: "c1", description: "ONLINE TRANSFER", date: "2025-01-01", workspaceId: "ws-1", statementId: "st-1", originalRowIndex: 0, balance: null, createdAt: "2025-01-01T00:00:00.000Z" },
      { id: "t2", amount: 500, bankAccountId: "a2", companyId: "c1", description: "ONLINE TRANSFER", date: "2025-01-02", workspaceId: "ws-1", statementId: "st-1", originalRowIndex: 1, balance: null, createdAt: "2025-01-01T00:00:00.000Z" },
      { id: "t3", amount: 1000, bankAccountId: "a1", companyId: "c1", description: "Rent income", date: "2025-01-03", workspaceId: "ws-1", statementId: "st-1", originalRowIndex: 2, balance: null, createdAt: "2025-01-01T00:00:00.000Z" },
    ];
    const classifications = [
      { transactionId: "t1", finalCategory: "Transfer Clearing", reportType: "Balance Sheet" as const, reviewStatus: "approved" as const, confidence: "high" as const, ruleUsed: "test", id: "c1", isManualCorrection: false, createdAt: "", updatedAt: "" },
      { transactionId: "t2", finalCategory: "Transfer Clearing", reportType: "Balance Sheet" as const, reviewStatus: "approved" as const, confidence: "high" as const, ruleUsed: "test", id: "c2", isManualCorrection: false, createdAt: "", updatedAt: "" },
      { transactionId: "t3", finalCategory: "Rental Income", reportType: "P&L" as const, reviewStatus: "approved" as const, confidence: "high" as const, ruleUsed: "test", id: "c3", isManualCorrection: false, createdAt: "", updatedAt: "" },
    ];

    const report = buildFinancialReport("Test LLC", 2025, accounts, transactions, classifications);
    expect(report.matchedTransferCount).toBe(1);
    expect(report.matchedTransferAmount).toBe(500);
  });

  it("excludes matched transfers from BS", () => {
    const accounts = [
      { id: "a1", openingBalance: 1000, closingBalance: 1500, accountName: "Checking", companyId: "c1" },
      { id: "a2", openingBalance: 500, closingBalance: 1000, accountName: "Savings", companyId: "c1" },
    ];
    const transactions = [
      { id: "t1", amount: -500, bankAccountId: "a1", companyId: "c1", description: "ONLINE TRANSFER", date: "2025-01-01", workspaceId: "ws-1", statementId: "st-1", originalRowIndex: 0, balance: null, createdAt: "2025-01-01T00:00:00.000Z" },
      { id: "t2", amount: 500, bankAccountId: "a2", companyId: "c1", description: "ONLINE TRANSFER", date: "2025-01-02", workspaceId: "ws-1", statementId: "st-1", originalRowIndex: 1, balance: null, createdAt: "2025-01-01T00:00:00.000Z" },
      { id: "t3", amount: 200, bankAccountId: "a1", companyId: "c1", description: "Contribution", date: "2025-01-03", workspaceId: "ws-1", statementId: "st-1", originalRowIndex: 2, balance: null, createdAt: "2025-01-01T00:00:00.000Z" },
    ];
    const classifications = [
      { transactionId: "t1", finalCategory: "Transfer Clearing", reportType: "Balance Sheet" as const, reviewStatus: "approved" as const, confidence: "high" as const, ruleUsed: "test", id: "c1", isManualCorrection: false, createdAt: "", updatedAt: "" },
      { transactionId: "t2", finalCategory: "Transfer Clearing", reportType: "Balance Sheet" as const, reviewStatus: "approved" as const, confidence: "high" as const, ruleUsed: "test", id: "c2", isManualCorrection: false, createdAt: "", updatedAt: "" },
      { transactionId: "t3", finalCategory: "Capital contributions", reportType: "Balance Sheet" as const, reviewStatus: "approved" as const, confidence: "high" as const, ruleUsed: "test", id: "c3", isManualCorrection: false, createdAt: "", updatedAt: "" },
    ];

    const report = buildFinancialReport("Test LLC", 2025, accounts, transactions, classifications);
    // Transfer Clearing should not appear in BS (both matched)
    expect(Object.keys(report.balanceSheet.assets).filter(k => k.toLowerCase().includes("transfer"))).toHaveLength(0);
    // Capital contributions should still show
    expect(report.balanceSheet.equity["Capital contributions"]).toBe(200);
  });
});

describe("determineFinancialReportMode", () => {
  it("returns complete_balance_sheet when all conditions met", () => {
    const result = determineFinancialReportMode(true, false, false, true, "passed", "complete");
    expect(result.mode).toBe("complete_balance_sheet");
  });

  it("returns preliminary_balance_sheet when opening balances exist but suspense", () => {
    const result = determineFinancialReportMode(true, true, false, true, "incomplete_data", "incomplete");
    expect(result.mode).toBe("preliminary_balance_sheet");
  });

  it("returns classified_bank_activity when no opening balances", () => {
    const result = determineFinancialReportMode(false, false, false, false, "incomplete_data", "incomplete");
    expect(result.mode).toBe("classified_bank_activity");
  });
});
