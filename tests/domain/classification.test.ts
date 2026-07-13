import { describe, expect, it } from "vitest";
import { classifyTransaction } from "../../src/domain/classification";
import type { Transaction } from "../../src/domain/types";

const tx = (description: string, amount: number): Transaction => ({
  id: `${description}-${amount}`,
  workspaceId: "ws-1",
  bankAccountId: "ba-1",
  statementId: "st-1",
  date: "2025-01-15",
  description,
  amount,
  balance: null,
  originalRowIndex: 0,
  createdAt: "2025-01-15T00:00:00.000Z",
});

describe("classifyTransaction", () => {
  it("keeps owner contributions off P&L", () => {
    const c = classifyTransaction(tx("CAPITAL CONTRIBUTION OWNER", 50000));
    expect(c.reportType).toBe("Balance Sheet");
    expect(c.finalCategory).toBe("Owner Contributions");
  });

  it("keeps credit card payments off P&L", () => {
    const c = classifyTransaction(tx("AUTOPAY AMEX PAYMENT", -3000));
    expect(c.reportType).toBe("Balance Sheet");
    expect(c.finalCategory).toBe("Credit Card Liability");
  });

  it("routes K-1 items to review", () => {
    const c = classifyTransaction(tx("K-1 income from investment LLC", 2500));
    expect(c.reportType).toBe("Balance Sheet");
    expect(c.reviewStatus).toBe("pending");
  });

  it("classifies rental income as P&L", () => {
    const c = classifyTransaction(tx("RENTAL INCOME January", 12000));
    expect(c.reportType).toBe("P&L");
    expect(c.finalCategory).toBe("Rental Income");
    expect(c.confidence).toBe("high");
  });

  it("classifies bank fees as P&L", () => {
    const c = classifyTransaction(tx("MONTHLY BANK FEE", -35));
    expect(c.reportType).toBe("P&L");
    expect(c.finalCategory).toBe("Bank Fees");
  });

  it("classifies interest expense as P&L", () => {
    const c = classifyTransaction(tx("LOAN INTEREST CHARGE", -200));
    expect(c.reportType).toBe("P&L");
    expect(c.finalCategory).toBe("Interest Expense");
  });

  it("classifies utilities as P&L", () => {
    const c = classifyTransaction(tx("PG&E UTILITY BILL", -145));
    expect(c.reportType).toBe("P&L");
    expect(c.finalCategory).toBe("Utilities");
  });

  it("flags capital improvements for review", () => {
    const c = classifyTransaction(tx("ROOF REPAIR CAPITAL IMPROVEMENT", -5000));
    expect(c.finalCategory).toBe("Capital Improvements");
    expect(c.reviewStatus).toBe("pending");
  });
});
