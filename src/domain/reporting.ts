import type { Classification, PnlReport, BalanceSheetReport, ReportPackage, TransactionWithClassification } from "./types";

const add = (record: Record<string, number>, key: string, amount: number) => {
  record[key] = Math.round(((record[key] ?? 0) + amount) * 100) / 100;
};

export function buildReportsFromClassifications(
  entityName: string,
  taxYear: number,
  rows: { transaction: { amount: number }; classification: Classification }[]
): ReportPackage {
  const income: Record<string, number> = {};
  const expenses: Record<string, number> = {};
  const assets: Record<string, number> = {};
  const liabilities: Record<string, number> = {};
  const equity: Record<string, number> = {};

  for (const row of rows) {
    const c = row.classification;
    const amount = row.transaction.amount;
    if (!c || c.reviewStatus === "excluded") continue;
    if (c.finalCategory.includes("Uncategorized")) continue;

    if (c.reportType === "P&L") {
      if (amount >= 0) add(income, c.finalCategory, amount);
      else add(expenses, c.finalCategory, Math.abs(amount));
    } else {
      const isLiability = /(payable|liability|Due To|Loan)/i.test(c.finalCategory);
      const isEquity = /(contribution|distribution|net income)/i.test(c.finalCategory);
      if (isLiability) add(liabilities, c.finalCategory, amount);
      else if (isEquity) add(equity, c.finalCategory, amount);
      else add(assets, c.finalCategory, amount);
    }
  }

  const totalIncome = Object.values(income).reduce((s, v) => s + v, 0);
  const totalExpenses = Object.values(expenses).reduce((s, v) => s + v, 0);
  const netIncome = Math.round((totalIncome - totalExpenses) * 100) / 100;
  if (!equity["Current Year Net Income"]) equity["Current Year Net Income"] = 0;
  equity["Current Year Net Income"] += netIncome;

  const balanceSheet: BalanceSheetReport = { assets, liabilities, equity, balanceCheck: 0 };
  const totalAssets = Object.values(assets).reduce((s, v) => s + v, 0);
  const totalLiabilities = Object.values(liabilities).reduce((s, v) => s + v, 0);
  const totalEquity = Object.values(equity).reduce((s, v) => s + v, 0);
  balanceSheet.balanceCheck = Math.round((totalAssets - totalLiabilities - totalEquity) * 100) / 100;

  return { entityName, taxYear, pnl: { income, expenses, netIncome }, balanceSheet };
}

export function buildReports(entityName: string, taxYear: number, classifications: TransactionWithClassification[]): ReportPackage {
  return buildReportsFromClassifications(
    entityName,
    taxYear,
    classifications
      .filter((t) => t.classification)
      .map((t) => ({ transaction: t, classification: t.classification! }))
  );
}
