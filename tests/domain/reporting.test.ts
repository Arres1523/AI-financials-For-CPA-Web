import { describe, expect, it } from "vitest";
import { buildReports } from "../../src/domain/reporting";

describe("buildReports", () => {
  it("keeps balance-sheet activity out of P&L", () => {
    const reports = buildReports("Demo LLC", 2025, [
      {
        id: "1",
        transactionId: "1",
        date: "2025-01-01",
        sourceAccount: "Bank",
        description: "Rent",
        amount: 1000,
        sourceCategory: "",
        type: "",
        sourceBalance: null,
        sourceFile: "jan.csv",
        finalCategory: "Rental Income",
        statement: "P&L",
        pnlLine: "Rental Income",
        pnlAmount: 1000,
        bsLine: "",
        bsCounterpartAmount: 0,
        reviewStatus: "",
        source: "rule"
      },
      {
        id: "2",
        transactionId: "2",
        date: "2025-01-02",
        sourceAccount: "Bank",
        description: "Contribution",
        amount: 5000,
        sourceCategory: "",
        type: "",
        sourceBalance: null,
        sourceFile: "jan.csv",
        finalCategory: "Capital contributions",
        statement: "Balance Sheet",
        pnlLine: "",
        pnlAmount: 0,
        bsLine: "Capital contributions",
        bsCounterpartAmount: 5000,
        reviewStatus: "",
        source: "rule"
      }
    ]);
    expect(reports.pnl.netIncome).toBe(1000);
    expect(reports.balanceSheet.equity["Capital contributions"]).toBe(5000);
  });
});
