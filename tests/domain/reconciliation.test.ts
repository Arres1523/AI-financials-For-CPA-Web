import { describe, expect, it } from "vitest";
import { reconcileAccountPeriod } from "../../src/domain/reconciliation";
import type { Transaction } from "../../src/domain/types";

const tx = (id: string, amount: number): Transaction => ({
  id,
  workspaceId: "ws-1",
  bankAccountId: "ba-1",
  statementId: "st-1",
  date: "2025-01-01",
  description: "test",
  amount,
  balance: null,
  originalRowIndex: 0,
  createdAt: "2025-01-01T00:00:00.000Z",
});

describe("reconcileAccountPeriod", () => {
  it("marks a period reconciled when opening plus movement equals closing", () => {
    const result = reconcileAccountPeriod(1000, 1250, [tx("1", 300), tx("2", -50)]);
    expect(result).toEqual({
      accountId: "ba-1",
      accountName: "",
      openingBalance: 1000,
      movementTotal: 250,
      expectedClosingBalance: 1250,
      closingBalance: 1250,
      variance: 0,
      status: "reconciled",
    });
  });

  it("marks unreconciled when there is a variance", () => {
    const result = reconcileAccountPeriod(1000, 1400, [tx("1", 300)]);
    expect(result.status).toBe("unreconciled");
    expect(result.variance).toBe(100);
  });
});
