import type { BalanceSheetReport, ReconciliationResult, Transaction } from "./types";

const cents = (value: number) => Math.round(value * 100) / 100;

export function reconcileAccountPeriod(
  openingBalance: number,
  closingBalance: number,
  transactions: Transaction[]
): ReconciliationResult {
  const movementTotal = cents(transactions.reduce((sum, transaction) => sum + transaction.amount, 0));
  const expectedClosingBalance = cents(openingBalance + movementTotal);
  const variance = cents(closingBalance - expectedClosingBalance);

  return {
    movementTotal,
    expectedClosingBalance,
    variance,
    status: Math.abs(variance) <= 0.01 ? "reconciled" : "unreconciled"
  };
}

export function calculateBalanceCheck(report: BalanceSheetReport): number {
  const assets = Object.values(report.assets).reduce((sum, value) => sum + value, 0);
  const liabilities = Object.values(report.liabilities).reduce((sum, value) => sum + value, 0);
  const equity = Object.values(report.equity).reduce((sum, value) => sum + value, 0);
  return cents(assets - liabilities - equity);
}
