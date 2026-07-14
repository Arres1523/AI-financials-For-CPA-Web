import { describe, expect, it } from "vitest";
import { classifyTransaction } from "../../src/domain/classification";
import { CATEGORY_OPTIONS, isValidCategory, getCategoriesByReport } from "../../src/domain/categoryOptions";
import type { Transaction } from "../../src/domain/types";

function tx(description: string, amount: number): Transaction {
  return {
    id: "test", date: "2025-01-01", description, amount, workspaceId: "ws1",
    bankAccountId: "ba1", statementId: "st1", balance: null, originalRowIndex: 0, createdAt: "2025-01-01T00:00:00Z",
  };
}

describe("categoryOptions", () => {
  it("lists all categories the classification engine can produce", () => {
    const descriptions: { desc: string; amount: number }[] = [
      { desc: "Online Transfer from CHK ...1234", amount: 5000 },
      { desc: "DOMESTIC WIRE TRANSFER", amount: -10000 },
      { desc: "AMEX PAYMENT", amount: -500 },
      { desc: "CAPITAL CALL", amount: 25000 },
      { desc: "DISTRIBUTION TO OWNER", amount: -5000 },
      { desc: "VALORIS RELATED PARTY PAYMENT", amount: -2000 },
      { desc: "LOAN PROCEEDS", amount: 100000 },
      { desc: "RENTAL INCOME tenant", amount: 3000 },
      { desc: "RENT PAYMENT", amount: -1500 },
      { desc: "OTHER INCOME MISC", amount: 500 },
      { desc: "CAPITAL IMPROVEMENT ROOF", amount: -15000 },
      { desc: "HVAC REPAIR", amount: -2000 },
      { desc: "ELECTRIC BILL", amount: -400 },
      { desc: "INSURANCE PREMIUM", amount: -1200 },
      { desc: "PROPERTY TAX PAYMENT", amount: -6000 },
      { desc: "LEGAL SERVICES", amount: -3000 },
      { desc: "MANAGEMENT FEE", amount: -1000 },
      { desc: "TRAN FEE INTUIT", amount: -20 },
      { desc: "BANK FEE MONTHLY", amount: -10 },
      { desc: "INTEREST EXPENSE", amount: -800 },
      { desc: "SOFTWARE SUBSCRIPTION", amount: -200 },
      { desc: "K-1 SCHEDULE", amount: 0 },
      { desc: "UNKNOWN RANDOM CHARGE", amount: -50 },
      { desc: "SIGONFILE TEST DEPOSIT", amount: 0.01 },
      { desc: "WYNDHAM INVESTMENT GROUP LLC", amount: 700 },
    ];

    const seen = new Set<string>();
    for (const { desc, amount } of descriptions) {
      const result = classifyTransaction(tx(desc, amount));
      seen.add(result.finalCategory);
    }

    for (const cat of seen) {
      expect(isValidCategory(cat)).toBe(true);
    }

    const optionValues = new Set(CATEGORY_OPTIONS.map((o) => o.value));
    for (const cat of seen) {
      expect(optionValues.has(cat)).toBe(true);
    }
  });

  it("returns unique entries with no duplicates", () => {
    const values = CATEGORY_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("has every entry as its own label (no display-name aliasing)", () => {
    for (const opt of CATEGORY_OPTIONS) {
      expect(opt.value).toBe(opt.label);
    }
  });

  it("each option has a valid reportType", () => {
    for (const opt of CATEGORY_OPTIONS) {
      expect(["P&L", "Balance Sheet"]).toContain(opt.reportType);
    }
  });

  it("getCategoriesByReport returns correct subsets", () => {
    const pl = getCategoriesByReport("P&L");
    const bs = getCategoriesByReport("Balance Sheet");
    expect(pl.length).toBeGreaterThan(0);
    expect(bs.length).toBeGreaterThan(0);

    for (const cat of pl) {
      const opt = CATEGORY_OPTIONS.find((o) => o.value === cat);
      expect(opt?.reportType).toBe("P&L");
    }
    for (const cat of bs) {
      const opt = CATEGORY_OPTIONS.find((o) => o.value === cat);
      expect(opt?.reportType).toBe("Balance Sheet");
    }
  });
});
