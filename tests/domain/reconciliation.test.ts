import { describe, expect, it } from "vitest";
import { reconcileAccountPeriod } from "../../src/domain/reconciliation";

describe("reconcileAccountPeriod", () => {
  it("marks a period reconciled when opening plus movement equals closing", () => {
    const result = reconcileAccountPeriod(1000, 1250, [
      {
        id: "1",
        date: "2025-01-01",
        sourceAccount: "Bank",
        description: "Rent",
        amount: 300,
        sourceCategory: "",
        type: "",
        sourceBalance: null,
        sourceFile: "jan.csv"
      },
      {
        id: "2",
        date: "2025-01-02",
        sourceAccount: "Bank",
        description: "Fee",
        amount: -50,
        sourceCategory: "",
        type: "",
        sourceBalance: null,
        sourceFile: "jan.csv"
      }
    ]);
    expect(result).toEqual({ movementTotal: 250, expectedClosingBalance: 1250, variance: 0, status: "reconciled" });
  });
});
