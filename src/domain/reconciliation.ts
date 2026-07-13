import type { ReconciliationResult, Transaction } from "./types";

const cents = (value: number) => Math.round(value * 100) / 100;

export function reconcileAccountPeriod(
  openingBalance: number,
  closingBalance: number,
  transactions: Transaction[]
): ReconciliationResult {
  const movementTotal = cents(transactions.reduce((sum, t) => sum + t.amount, 0));
  const expectedClosingBalance = cents(openingBalance + movementTotal);
  const variance = cents(closingBalance - expectedClosingBalance);
  return {
    accountId: transactions[0]?.bankAccountId ?? "",
    accountName: "",
    openingBalance,
    movementTotal,
    expectedClosingBalance,
    closingBalance,
    variance,
    status: Math.abs(variance) <= 0.01 ? "reconciled" : "unreconciled",
  };
}
