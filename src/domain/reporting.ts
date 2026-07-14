import type { Classification, PnlReport, BalanceSheetReport, ReportPackage, TransactionWithClassification, BankAccount, BankReconciliationCheck, ClassificationCompletenessCheck, AccountingEquationCheck, FinancialReportMode, FinancialReport, SuspenseItem, Transaction } from "./types";
import { reconcileAccountPeriod } from "./reconciliation";
import { matchInternalTransfers } from "./transferMatching";

const cents = (v: number) => Math.round(v * 100) / 100;

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

  // Review policy: only "excluded" and "Uncategorized" are filtered from reports.
  // Items with card_statements_needed, support_needed, cpa_review, or pending
  // remain included — they are correctly classified and should appear in reports.
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

export function buildBankReconciliation(
  accounts: Pick<BankAccount, "id" | "openingBalance" | "closingBalance" | "accountName">[],
  transactionsByAccount: Record<string, { amount: number }[]>
): BankReconciliationCheck[] {
  return accounts.map((a) => {
    const result = reconcileAccountPeriod(a.openingBalance, a.closingBalance, (transactionsByAccount[a.id] ?? []).map(t => ({ ...t, bankAccountId: a.id })) as any);
    return {
      accountId: a.id,
      accountName: a.accountName ?? "Unknown",
      openingBalance: result.openingBalance,
      movementTotal: result.movementTotal,
      expectedClosingBalance: result.expectedClosingBalance,
      actualClosingBalance: result.closingBalance,
      variance: result.variance,
      status: result.status,
    };
  });
}

export function buildClassificationCompleteness(classifications: Classification[]): ClassificationCompletenessCheck {
  const total = classifications.length;
  const approved = classifications.filter(c => c.reviewStatus === "approved").length;
  const excluded = classifications.filter(c => c.reviewStatus === "excluded").length;
  const unresolvedStatuses = ["pending", "support_needed", "cpa_review", "card_statements_needed"];
  const unresolved = classifications.filter(c => unresolvedStatuses.includes(c.reviewStatus));
  const suspense = classifications.filter(c => c.finalCategory?.includes("Uncategorized") || c.reviewStatus === "pending");
  return {
    totalTransactions: total,
    approved,
    excluded,
    unresolved: unresolved.length,
    unresolvedAmount: cents(unresolved.reduce((s, c) => s + Math.abs(0), 0)),
    suspenseAmount: cents(suspense.reduce((s, c) => s + Math.abs(0), 0)),
    status: unresolved.length > 0 ? "incomplete" : "complete",
  };
}

export function buildAccountingEquation(
  totalAssets: number,
  totalLiabilities: number,
  totalEquity: number,
  openingBalancesExist: boolean,
  hasSuspense: boolean,
  hasCardStatementsNeeded: boolean
): AccountingEquationCheck {
  const difference = cents(totalAssets - totalLiabilities - totalEquity);
  const missingInputs: string[] = [];
  if (!openingBalancesExist) missingInputs.push("Opening Balance Sheet not provided");
  if (hasSuspense) missingInputs.push("Unresolved suspense entries");
  if (hasCardStatementsNeeded) missingInputs.push("Credit card statements not imported");

  let status: "passed" | "failed" | "incomplete_data";
  if (missingInputs.length > 0) {
    status = "incomplete_data";
  } else if (Math.abs(difference) <= 0.01) {
    status = "passed";
  } else {
    status = "failed";
  }

  return { totalAssets, totalLiabilities, totalEquity, difference, status, missingInputs };
}

export function determineFinancialReportMode(
  openingBalancesExist: boolean,
  hasSuspense: boolean,
  hasCardStatementsNeeded: boolean,
  allAccountsReconciled: boolean,
  equationStatus: string,
  classificationStatus: string
): { mode: FinancialReportMode; reasons: string[] } {
  const reasons: string[] = [];

  if (openingBalancesExist && !hasSuspense && !hasCardStatementsNeeded
      && allAccountsReconciled && equationStatus === "passed" && classificationStatus === "complete") {
    return { mode: "complete_balance_sheet", reasons };
  }

  if (!openingBalancesExist) reasons.push("Opening Balance Sheet not provided");
  if (hasSuspense) reasons.push("Unresolved suspense entries exist");
  if (hasCardStatementsNeeded) reasons.push("Credit card statements pending");
  if (!allAccountsReconciled) reasons.push("One or more bank accounts not reconciled");
  if (equationStatus !== "passed") reasons.push("Accounting equation not satisfied");
  if (classificationStatus !== "complete") reasons.push("Classification review incomplete");

  if (openingBalancesExist || hasSuspense || hasCardStatementsNeeded) {
    return { mode: "preliminary_balance_sheet", reasons };
  }

  return { mode: "classified_bank_activity", reasons };
}

export function buildFinancialReport(
  entityName: string,
  taxYear: number,
  accounts: Pick<BankAccount, "id" | "openingBalance" | "closingBalance" | "accountName" | "companyId">[],
  transactions: Transaction[],
  classifications: Classification[]
): FinancialReport {
  const companyId = accounts[0]?.companyId ?? "";

  // Match internal transfers FIRST so we can exclude them from BS/P&L reports
  const matchedResult = matchInternalTransfers(transactions, accounts.map(a => a.id), companyId);
  const matchedTxIds = new Set<string>();
  for (const pair of matchedResult.matchedPairs) {
    matchedTxIds.add(pair.outTransactionId);
    matchedTxIds.add(pair.inTransactionId);
  }

  // Filter out matched transfers before building reports
  const classByTxId = new Map(classifications.map(c => [c.transactionId, c]));
  const filteredTransactions = transactions.filter(t => !matchedTxIds.has(t.id));

  // Compute P&L and BS excluding matched transfers
  const { pnl, balanceSheet } = buildReports(entityName, taxYear, filteredTransactions.map(t => ({ ...t, classification: classByTxId.get(t.id) ?? null, date: "", description: "", balance: null, originalRowIndex: 0, id: "", workspaceId: "", bankAccountId: "", statementId: "", createdAt: "" })) as any);

  // Group all transactions by account (use all for reconciliation — cash tracking is independent)
  const txByAcct: Record<string, { amount: number }[]> = {};
  for (const t of transactions) {
    if (!txByAcct[t.bankAccountId]) txByAcct[t.bankAccountId] = [];
    txByAcct[t.bankAccountId].push(t);
  }

  const bankReconciliation = buildBankReconciliation(accounts, txByAcct);
  const classificationCompleteness = buildClassificationCompleteness(classifications);

  const hasSuspense = classifications.some(c => c.finalCategory?.includes("Uncategorized") || c.reviewStatus === "pending");
  const hasCardStatementsNeeded = classifications.some(c => c.reviewStatus === "card_statements_needed");
  const allAccountsReconciled = bankReconciliation.every(r => r.status === "reconciled");
  const openingBalancesExist = accounts.some(a => a.openingBalance !== 0);

  const totalAssets = Object.values(balanceSheet.assets).reduce((s, v) => s + v, 0);
  const totalLiabilities = Object.values(balanceSheet.liabilities).reduce((s, v) => s + v, 0);
  const totalEquity = Object.values(balanceSheet.equity).reduce((s, v) => s + v, 0);

  const matchedAmount = cents(matchedResult.matchedPairs.reduce((s, p) => s + p.amount, 0));

  const accountingEquation = buildAccountingEquation(
    totalAssets, totalLiabilities, totalEquity,
    openingBalancesExist, hasSuspense, hasCardStatementsNeeded
  );

  const { mode, reasons } = determineFinancialReportMode(
    openingBalancesExist, hasSuspense, hasCardStatementsNeeded,
    allAccountsReconciled, accountingEquation.status, classificationCompleteness.status
  );

  // Suspense items
  const suspense: SuspenseItem[] = classifications
    .filter(c => c.finalCategory?.includes("Uncategorized") || c.reviewStatus === "pending")
    .map(c => ({
      transactionId: c.transactionId,
      date: "",
      description: "",
      amount: 0,
      currentCategory: c.finalCategory ?? "Unknown",
      reviewStatus: c.reviewStatus,
      reason: c.ruleUsed ?? "Unresolved classification",
    }));

  // Cash from real balances
  const actualCash = cents(accounts.reduce((s, a) => s + (a.closingBalance ?? 0), 0));
  const movementTotal = cents(transactions.reduce((s, t) => s + t.amount, 0));
  const openingCash = cents(accounts.reduce((s, a) => s + (a.openingBalance ?? 0), 0));
  const expectedCash = cents(openingCash + movementTotal);
  const totalCashVariance = cents(actualCash - expectedCash);

  return {
    mode,
    modeReasons: reasons,
    entityName,
    taxYear,
    pnl,
    balanceSheet,
    bankReconciliation,
    classificationCompleteness,
    accountingEquation,
    suspense,
    actualCash,
    expectedCash,
    totalCashVariance,
    matchedTransferCount: matchedResult.matchedPairs.length,
    matchedTransferAmount: matchedAmount,
  };
}
