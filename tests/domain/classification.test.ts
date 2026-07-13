import { describe, expect, it } from "vitest";
import { classifyTransaction } from "../../src/domain/classification";
import type { Transaction } from "../../src/domain/types";

const tx = (description: string, amount: number): Transaction => ({
  id: `${description}-${amount}`,
  date: "2025-01-15",
  sourceAccount: "Chase Operating",
  description,
  amount,
  sourceCategory: "",
  type: "",
  sourceBalance: null,
  sourceFile: "jan.csv"
});

describe("classifyTransaction", () => {
  it("keeps owner contributions off P&L", () => {
    expect(classifyTransaction(tx("CAPITAL CONTRIBUTION OWNER", 50000))).toMatchObject({
      statement: "Balance Sheet",
      finalCategory: "Capital contributions",
      pnlAmount: 0
    });
  });

  it("keeps credit card payments off P&L and requests card statements", () => {
    expect(classifyTransaction(tx("AUTOPAY AMEX PAYMENT", -3000))).toMatchObject({
      statement: "Balance Sheet",
      bsLine: "Credit card payable",
      reviewStatus: "Credit Card Statements Needed"
    });
  });

  it("routes K-1 items to CPA Review", () => {
    expect(classifyTransaction(tx("K-1 income from investment LLC", 2500))).toMatchObject({
      statement: "Balance Sheet",
      reviewStatus: "CPA Review"
    });
  });
});
