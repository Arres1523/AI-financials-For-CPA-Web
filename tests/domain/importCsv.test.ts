import { describe, expect, it } from "vitest";
import { normalizeCsvRows } from "../../src/domain/importCsv";

describe("normalizeCsvRows", () => {
  it("normalizes date, description, amount, and source metadata", () => {
    const csv = "Date,Description,Amount,Balance\n01/05/2025,BANK FEE,-12.00,9988.00";
    const rows = normalizeCsvRows(csv, "Chase Operating", "jan.csv", "ws-1", "ba-1", "st-1");
    expect(rows[0]).toMatchObject({
      date: "2025-01-05",
      description: "BANK FEE",
      amount: -12,
      balance: 9988,
      workspaceId: "ws-1",
      bankAccountId: "ba-1",
    });
  });
});
