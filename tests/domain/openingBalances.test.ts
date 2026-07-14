import { describe, expect, it } from "vitest";
import { validateOpeningBalanceSheet } from "../../src/domain/openingBalances";

describe("validateOpeningBalanceSheet", () => {
  it("passes when assets = liabilities + equity", () => {
    const entries = [
      { accountType: "asset", amount: 10000 },
      { accountType: "liability", amount: 3000 },
      { accountType: "equity", amount: 7000 },
    ];
    const result = validateOpeningBalanceSheet(entries as any);
    expect(result.isValid).toBe(true);
    expect(result.difference).toBe(0);
  });

  it("fails when assets != liabilities + equity", () => {
    const entries = [
      { accountType: "asset", amount: 10000 },
      { accountType: "liability", amount: 2000 },
      { accountType: "equity", amount: 7000 },
    ];
    const result = validateOpeningBalanceSheet(entries as any);
    expect(result.isValid).toBe(false);
    expect(result.difference).toBe(1000);
  });

  it("handles empty entries", () => {
    const result = validateOpeningBalanceSheet([]);
    expect(result.isValid).toBe(true);
    expect(result.difference).toBe(0);
  });
});
