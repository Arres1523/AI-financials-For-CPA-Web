import type { ClassifiedTransaction, ReportPackage } from "./types";
import { calculateBalanceCheck } from "./reconciliation";

const add = (record: Record<string, number>, key: string, amount: number) => {
  record[key] = Math.round(((record[key] ?? 0) + amount) * 100) / 100;
};

export function buildReports(entityName: string, taxYear: number, classifications: ClassifiedTransaction[]): ReportPackage {
  const income: Record<string, number> = {};
  const expenses: Record<string, number> = {};
  const assets: Record<string, number> = {};
  const liabilities: Record<string, number> = {};
  const equity: Record<string, number> = {};

  for (const row of classifications) {
    if (row.statement === "P&L" && row.pnlLine) {
      if (row.pnlAmount >= 0) add(income, row.pnlLine, row.pnlAmount);
      else add(expenses, row.pnlLine, Math.abs(row.pnlAmount));
    }

    if (row.statement === "Balance Sheet" && row.bsLine) {
      if (row.bsLine.includes("payable") || row.bsLine.startsWith("Due to")) add(liabilities, row.bsLine, row.bsCounterpartAmount);
      else if (row.bsLine.includes("contributions") || row.bsLine.includes("distributions")) add(equity, row.bsLine, row.bsCounterpartAmount);
      else add(assets, row.bsLine, row.bsCounterpartAmount);
    }
  }

  const totalIncome = Object.values(income).reduce((sum, value) => sum + value, 0);
  const totalExpenses = Object.values(expenses).reduce((sum, value) => sum + value, 0);
  const netIncome = Math.round((totalIncome - totalExpenses) * 100) / 100;
  equity["Current year net income"] = netIncome;

  const balanceSheet = { assets, liabilities, equity, balanceCheck: 0 };
  balanceSheet.balanceCheck = calculateBalanceCheck(balanceSheet);

  return {
    entityName,
    taxYear,
    pnl: { income, expenses, netIncome },
    balanceSheet
  };
}
