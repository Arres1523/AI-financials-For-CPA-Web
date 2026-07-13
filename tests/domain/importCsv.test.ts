import { describe, expect, it } from "vitest";
import { normalizeCsvRows } from "../../src/domain/importCsv";

describe("normalizeCsvRows", () => {
  it("normalizes date, description, amount, and source metadata", () => {
    const csv = "Date,Description,Amount,Balance\n01/05/2025,BANK FEE,-12.00,9988.00";
    expect(normalizeCsvRows(csv, "Chase Operating", "jan.csv")[0]).toMatchObject({
      date: "2025-01-05",
      sourceAccount: "Chase Operating",
      description: "BANK FEE",
      amount: -12,
      sourceBalance: 9988,
      sourceFile: "jan.csv"
    });
  });
});
