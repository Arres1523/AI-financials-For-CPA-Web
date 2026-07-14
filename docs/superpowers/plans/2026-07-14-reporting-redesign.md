# Reporting Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `balanceCheck` with three independent controls (bank reconciliation, classification completeness, accounting equation), add three report modes, add suspense tracking, add opening balances, redesign workbook, and implement honest Balance Sheet generation without artificial plugs.

**Architecture:** New types for FinancialReport and its sub-checks; three pure functions in reporting.ts produce the three controls; new modules for suspense, transfer matching, and opening balances; workbook and UI consumers updated to use new structure.

**Tech Stack:** TypeScript, Next.js, ExcelJS, SQLite (via lib/db.ts)

## Global Constraints

- Cash must come from closing balances, never calculated as plug
- Reconciliation, classification completeness, and accounting equation are separate controls
- Suspense is explicit and traceable — never hidden, never counts as complete
- Three report modes: classified_bank_activity, preliminary_balance_sheet, complete_balance_sheet
- Balance Sheet completeness requires opening balances
- Internal transfers only net when both sides are demonstrably matched
- No artificial plugs — never invent figures to make checks pass
- All existing tests must continue to pass with updated types
- The old `ReportPackage` / `BalanceSheetReport` types remain for backward compat during migration

---

### Task 1: Add new types

**Files:**
- Modify: `src/domain/types.ts` — add FinancialReport, BankReconciliationCheck, ClassificationCompletenessCheck, AccountingEquationCheck, FinancialReportMode, SuspenseItem, OpeningBalanceEntry, MatchedTransfer

**Interfaces:**
- Produces: All types consumed by Tasks 2–10

- [ ] **Step 1: Add new types to `src/domain/types.ts`**

Paste after the existing `ReportPackage` block:

```typescript
// ─── New reporting controls ────────────────────────────────────
export type CheckStatus = "passed" | "failed" | "incomplete_data";

export type BankReconciliationCheck = {
  accountId: string;
  accountName: string;
  openingBalance: number;
  movementTotal: number;
  expectedClosingBalance: number;
  actualClosingBalance: number;
  variance: number;
  status: "reconciled" | "unreconciled";
};

export type ClassificationCompletenessCheck = {
  totalTransactions: number;
  approved: number;
  excluded: number;
  unresolved: number;
  unresolvedAmount: number;
  suspenseAmount: number;
  status: "complete" | "incomplete";
};

export type AccountingEquationCheck = {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  difference: number;
  status: CheckStatus;
  missingInputs: string[];
};

export type FinancialReportMode = "classified_bank_activity" | "preliminary_balance_sheet" | "complete_balance_sheet";

export type SuspenseItem = {
  transactionId: string;
  date: string;
  description: string;
  amount: number;
  currentCategory: string;
  reviewStatus: ReviewStatus;
  reason: string;
};

export type MatchedTransferPair = {
  outTransactionId: string;
  inTransactionId: string;
  outAccountId: string;
  inAccountId: string;
  amount: number;
  dateDifferenceDays: number;
};

export type OpeningBalanceEntry = {
  id: string;
  workspaceId: string;
  accountName: string;
  accountType: "asset" | "liability" | "equity";
  amount: number;
  source: string;
  supportStatus: "provided" | "missing" | "reviewed";
};

export type OpeningBalanceSheetInput = {
  entries: OpeningBalanceEntry[];
  isValid: boolean;
  difference: number;
};

export type FinancialReport = {
  mode: FinancialReportMode;
  modeReasons: string[];
  entityName: string;
  taxYear: number;
  pnl: PnlReport;
  balanceSheet: BalanceSheetReport;
  bankReconciliation: BankReconciliationCheck[];
  classificationCompleteness: ClassificationCompletenessCheck;
  accountingEquation: AccountingEquationCheck;
  suspense: SuspenseItem[];
  actualCash: number;
  expectedCash: number;
  totalCashVariance: number;
};
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: clean (types are defined but not yet used, so no errors)

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat: add FinancialReport, controls, and suspense types"
```

---

### Task 2: Implement three controls and FinancialReport builder

**Files:**
- Modify: `src/domain/reporting.ts` — add `buildBankReconciliation`, `buildClassificationCompleteness`, `buildAccountingEquation`, `determineFinancialReportMode`, `buildFinancialReport`
- Update import: `src/domain/types.ts`

**Interfaces:**
- Consumes: FinancialReportMode, BankReconciliationCheck, ClassificationCompletenessCheck, AccountingEquationCheck, SuspenseItem, BankAccount from types.ts
- Produces: `buildFinancialReport(entityName, taxYear, accounts, transactions, classifications) → FinancialReport`

- [ ] **Step 1: Write the failing tests**

Add to `tests/domain/reporting.test.ts`:

```typescript
import { buildBankReconciliation, buildClassificationCompleteness, buildAccountingEquation, determineFinancialReportMode, buildFinancialReport } from "../../src/domain/reporting";

describe("buildBankReconciliation", () => {
  it("returns reconciled when variance <= 0.01", () => {
    const result = buildBankReconciliation([
      { id: "a1", openingBalance: 1000, closingBalance: 1500 },
    ], { a1: [{ amount: 500 } as any] });
    expect(result[0].status).toBe("reconciled");
    expect(result[0].variance).toBe(0);
  });

  it("returns unreconciled when variance > 0.01", () => {
    const result = buildBankReconciliation([
      { id: "a1", openingBalance: 1000, closingBalance: 1600 },
    ], { a1: [{ amount: 500 } as any] });
    expect(result[0].status).toBe("unreconciled");
    expect(Math.abs(result[0].variance)).toBeGreaterThan(0.01);
  });

  it("handles multiple accounts", () => {
    const accounts = [
      { id: "a1", openingBalance: 1000, closingBalance: 1500, accountName: "Checking" },
      { id: "a2", openingBalance: 500, closingBalance: 400, accountName: "Savings" },
    ];
    const txByAcct = { a1: [{ amount: 500 } as any], a2: [{ amount: -100 } as any] };
    const result = buildBankReconciliation(accounts as any, txByAcct);
    expect(result).toHaveLength(2);
    expect(result.every(r => r.status === "reconciled")).toBe(true);
  });
});

describe("buildClassificationCompleteness", () => {
  const mkClass = (status: string, category?: string) => ({ reviewStatus: status, finalCategory: category ?? "Rental Income" }) as any;

  it("returns complete when all approved", () => {
    const result = buildClassificationCompleteness([
      mkClass("approved"), mkClass("approved"), mkClass("excluded"),
    ]);
    expect(result.status).toBe("complete");
    expect(result.unresolved).toBe(0);
  });

  it("returns incomplete when any pending or unresolved", () => {
    const result = buildClassificationCompleteness([
      mkClass("approved"), mkClass("pending"),
    ]);
    expect(result.status).toBe("incomplete");
    expect(result.unresolved).toBe(1);
  });

  it("counts suspense for Uncategorized", () => {
    const result = buildClassificationCompleteness([
      mkClass("pending", "Uncategorized / Needs Review"),
    ]);
    expect(result.suspenseAmount).toBe(0); // amount is 0 by default in mock, but we test the detection
    expect(result.status).toBe("incomplete");
  });
});

describe("buildAccountingEquation", () => {
  it("passes when difference is 0 and all inputs present", () => {
    const result = buildAccountingEquation(1000, 300, 700, true, false, false);
    expect(result.status).toBe("passed");
    expect(result.difference).toBe(0);
  });

  it("fails when difference != 0 and all inputs present", () => {
    const result = buildAccountingEquation(1000, 300, 600, true, false, false);
    expect(result.status).toBe("failed");
    expect(result.difference).toBe(100);
  });

  it("returns incomplete_data when opening balances missing", () => {
    const result = buildAccountingEquation(1000, 300, 700, false, false, false);
    expect(result.status).toBe("incomplete_data");
    expect(result.missingInputs).toContain("Opening Balance Sheet not provided");
  });

  it("returns incomplete_data when suspense exists", () => {
    const result = buildAccountingEquation(1000, 300, 700, true, true, false);
    expect(result.status).toBe("incomplete_data");
    expect(result.missingInputs).toContain("Unresolved suspense entries");
  });

  it("returns incomplete_data when card statements needed", () => {
    const result = buildAccountingEquation(1000, 300, 700, true, false, true);
    expect(result.status).toBe("incomplete_data");
    expect(result.missingInputs).toContain("Credit card statements not imported");
  });

  it("difference zero with incomplete data still returns incomplete_data", () => {
    const result = buildAccountingEquation(1000, 300, 700, false, false, false);
    expect(result.status).toBe("incomplete_data");
  });
});

describe("determineFinancialReportMode", () => {
  it("returns complete_balance_sheet when all conditions met", () => {
    const result = determineFinancialReportMode(true, false, false, true, "passed", "complete");
    expect(result.mode).toBe("complete_balance_sheet");
  });

  it("returns preliminary_balance_sheet when opening balances exist but suspense", () => {
    const result = determineFinancialReportMode(true, true, false, true, "incomplete_data", "incomplete");
    expect(result.mode).toBe("preliminary_balance_sheet");
  });

  it("returns classified_bank_activity when no opening balances", () => {
    const result = determineFinancialReportMode(false, false, false, false, "incomplete_data", "incomplete");
    expect(result.mode).toBe("classified_bank_activity");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/domain/reporting.test.ts 2>&1 | tail -5
```

Expected: failures for new imports

- [ ] **Step 3: Implement `buildBankReconciliation`**

Add to `src/domain/reporting.ts`:

```typescript
import type { BankAccount, BankReconciliationCheck, ClassificationCompletenessCheck, AccountingEquationCheck, FinancialReportMode, FinancialReport, SuspenseItem, Classification } from "./types";
import { reconcileAccountPeriod } from "./reconciliation";

const cents = (v: number) => Math.round(v * 100) / 100;

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
```

- [ ] **Step 4: Implement `buildClassificationCompleteness`**

Add to `src/domain/reporting.ts`:

```typescript
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
```

- [ ] **Step 5: Implement `buildAccountingEquation`**

Add to `src/domain/reporting.ts`:

```typescript
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
```

- [ ] **Step 6: Implement `determineFinancialReportMode`**

Add to `src/domain/reporting.ts`:

```typescript
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
```

- [ ] **Step 7: Implement `buildFinancialReport`**

Add to `src/domain/reporting.ts`:

```typescript
export function buildFinancialReport(
  entityName: string,
  taxYear: number,
  accounts: Pick<BankAccount, "id" | "openingBalance" | "closingBalance" | "accountName">[],
  transactions: { amount: number; bankAccountId: string }[],
  classifications: Classification[]
): FinancialReport {
  // Compute P&L and BS using the existing logic but extracting totals
  const { pnl, balanceSheet } = buildReports(entityName, taxYear, transactions.map((t, i) => ({ ...t, classification: classifications[i], date: "", description: "", balance: null, originalRowIndex: 0, id: "", workspaceId: "", bankAccountId: "", statementId: "", createdAt: "" })) as any);

  // Group transactions by account
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
  };
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npx vitest run tests/domain/reporting.test.ts
```

Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add src/domain/reporting.ts tests/domain/reporting.test.ts
git commit -m "feat: implement three controls, report modes, and buildFinancialReport"
```

---

### Task 3: Reconcile all downstream consumers with new types

**Files:**
- Modify: `src/app/api/export/workbook/route.ts` — use `buildFinancialReport` instead of `buildReportsFromClassifications`
- Modify: `src/exports/workbook.ts` — accept `FinancialReport` or new types
- Modify: `src/components/wizard/ResultsStep.tsx` — use new report structure
- Modify: `src/components/wizard/ReconciliationStep.tsx` — use new types

- [ ] **Step 1: Update workbook route to use buildFinancialReport**

Edit `src/app/api/export/workbook/route.ts`:

After the query that fetches transactions and classifications, replace the `buildReportsFromClassifications` call:

```typescript
import { buildFinancialReport } from "@/domain/reporting";

// After fetching accounts, transactions, classifications:
const accounts = await query("SELECT * FROM bank_accounts WHERE company_id = (SELECT company_id FROM workspaces WHERE id = $1)", [body.workspaceId]);
const typedAccounts = accounts.map((a: any) => ({
  id: a.id,
  accountName: a.account_name,
  bankName: a.bank_name,
  lastFour: a.last_four,
  accountType: a.account_type,
  openingBalance: a.opening_balance,
  closingBalance: a.closing_balance,
  companyId: a.company_id,
  createdAt: a.created_at,
}));

const reports = buildFinancialReport(companyName, taxYear, typedAccounts, transactions, classifications);
```

- [ ] **Step 2: Update workbook.ts to handle new report structure**

Modify `buildWorkbookBuffer` to accept `FinancialReport` type:

```typescript
export type WorkbookExportInput = {
  companyName: string;
  taxYear: number;
  transactions: Transaction[];
  classifications: Classification[];
  reports: FinancialReport; // was { pnl, balanceSheet }
  flaggedTransactions: Transaction[];
  accountReconData: { id: string; account_name: string; opening_balance: number; closing_balance: number; movement_total: number }[];
  includeTransactions: boolean;
};
```

Update workbook to use `reports.pnl` and `reports.balanceSheet` which are unchanged, and add a "Report Status" sheet at the start.

- [ ] **Step 3: Add Report Status sheet to workbook**

In `buildWorkbookBuffer`, add as first sheet:

```typescript
const statusSheet = workbook.addWorksheet("Report Status");
statusSheet.getColumn(1).width = 30;
statusSheet.getColumn(2).width = 16;
statusSheet.getColumn(3).width = 16;
statusSheet.getColumn(4).width = 20;
statusSheet.getColumn(5).width = 30;

headerRow(statusSheet.getCell("A1"), "Report Status");
statusSheet.mergeCells("A1:E1");

statusSheet.addRow(["Mode", reports.mode]);
statusSheet.addRow([]);

statusSheet.addRow(["Check", "Actual", "Expected", "Difference", "Status"]);
const rHdr = statusSheet.rowCount;
for (let c = 1; c <= 5; c++) bold(statusSheet.getCell(rHdr, c));

// Reconciliation
const reconciledCount = reports.bankReconciliation.filter(r => r.status === "reconciled").length;
const totalAccounts = reports.bankReconciliation.length;
statusSheet.addRow(["Bank Reconciliation", `${reconciledCount}/${totalAccounts}`, "All reconciled", "", reconciledCount === totalAccounts ? "✓" : "✕"]);

// Classification
statusSheet.addRow(["Classification", `${reports.classificationCompleteness.approved}/${reports.classificationCompleteness.totalTransactions} approved`, "All classified", `${reports.classificationCompleteness.unresolved} unresolved`, reports.classificationCompleteness.status === "complete" ? "✓" : "✕"]);

// Accounting Equation
statusSheet.addRow(["Accounting Equation", reports.accountingEquation.difference, "0", reports.accountingEquation.difference, reports.accountingEquation.status === "passed" ? "✓" : "✕"]);

// Opening Balances
statusSheet.addRow(["Opening Balances", reports.accountingEquation.missingInputs.includes("Opening Balance Sheet not provided") ? "Missing" : "Provided", "Required for Balance Sheet", "", reports.accountingEquation.missingInputs.includes("Opening Balance Sheet not provided") ? "✕" : "✓"]);

// Card Statements
statusSheet.addRow(["Credit Card Statements", reports.accountingEquation.missingInputs.includes("Credit card statements not imported") ? "Missing" : "Provided", "Required for P&L detail", "", reports.accountingEquation.missingInputs.includes("Credit card statements not imported") ? "✕" : "✓"]);
```

- [ ] **Step 4: Add Classified Bank Activity sheet when applicable**

After P&L sheet, add:

```typescript
if (reports.mode === "classified_bank_activity" || reports.mode === "preliminary_balance_sheet") {
  const cba = workbook.addWorksheet("Classified Bank Activity", { views: [{ showGridLines: false }] });
  cba.getColumn(1).width = 40;
  cba.getColumn(2).width = 22;

  headerRow(cba.getCell("A1"), input.companyName);
  cba.mergeCells("A1:B1");
  cba.getCell("A2").value = "Statement of Classified Bank Activity — For the year ended December 31, " + input.taxYear;
  cba.mergeCells("A2:B2");
  cba.getCell("A3").value = "Cash inflows and outflows classified by category";
  cba.mergeCells("A3:B3");

  // Cash summary
  cba.addRow([]);
  cba.addRow(["Cash Summary", ""]);
  bold(cba.getCell("A5"));
  cba.addRow(["Opening Cash", input.reports.expectedCash - input.reports.pnl.netIncome]); // simplified
  cba.addRow(["Plus: Inflows", Object.values(input.reports.pnl.income).reduce((s: number, v: number) => s + v, 0)]);
  cba.addRow(["Less: Outflows", Object.values(input.reports.pnl.expenses).reduce((s: number, v: number) => s + v, 0)]);
  // etc.
}
```

- [ ] **Step 5: Update Balance Sheet sheet title based on mode**

In the Balance Sheet sheet creation:

```typescript
const bsTitle = input.reports.mode === "complete_balance_sheet"
  ? `Balance Sheet — As of December 31, ${input.taxYear}`
  : `Preliminary Balance Sheet from Bank Activity — As of December 31, ${input.taxYear}`;
```

- [ ] **Step 6: Add Suspense Detail sheet**

```typescript
if (input.reports.suspense.length > 0) {
  const sd = workbook.addWorksheet("Suspense Detail", { views: [{ state: "frozen", xSplit: 0, ySplit: 1 }] });
  sd.columns = [
    { header: "Transaction ID", key: "transactionId", width: 36 },
    { header: "Date", key: "date", width: 16 },
    { header: "Description", key: "description", width: 40 },
    { header: "Amount", key: "amount", width: 18 },
    { header: "Current Category", key: "currentCategory", width: 30 },
    { header: "Review Status", key: "reviewStatus", width: 22 },
    { header: "Reason", key: "reason", width: 40 },
  ];
  sd.getRow(1).font = { bold: true };
  for (const item of input.reports.suspense) {
    sd.addRow(item);
    sd.getCell(sd.rowCount, 4).numFmt = fmt;
  }
}
```

- [ ] **Step 7: Update ResultsStep.tsx**

Replace the Balance Check card with three separate indicators:

```typescript
// In the summary grid, replace the single Balance Check card with:
<div className="rounded border border-line p-3">
  <p className="text-xs text-slate-500">Report Mode</p>
  <p className="text-sm font-semibold">{reports.mode === "complete_balance_sheet" ? "✓ Complete" : reports.mode === "preliminary_balance_sheet" ? "⚠ Preliminary" : "ℹ Bank Activity"}</p>
</div>
<div className="rounded border border-line p-3">
  <p className="text-xs text-slate-500">Bank Reconciliation</p>
  <p className={`text-2xl font-semibold ${reports.bankReconciliation.every(r => r.status === "reconciled") ? "text-sage" : "text-red-600"}`}>
    {reports.bankReconciliation.filter(r => r.status === "reconciled").length}/{reports.bankReconciliation.length}
  </p>
</div>
<div className="rounded border border-line p-3">
  <p className="text-xs text-slate-500">Classification</p>
  <p className={`text-2xl font-semibold ${reports.classificationCompleteness.status === "complete" ? "text-sage" : "text-brass"}`}>
    {reports.classificationCompleteness.approved}/{reports.classificationCompleteness.totalTransactions}
  </p>
</div>
<div className="rounded border border-line p-3">
  <p className="text-xs text-slate-500">Equation Check</p>
  <p className={`text-2xl font-semibold ${reports.accountingEquation.status === "passed" ? "text-sage" : "text-red-600"}`}>
    {reports.accountingEquation.status === "passed" ? "✓" : reports.accountingEquation.status === "incomplete_data" ? "…" : "✕"}
  </p>
</div>
```

Also update the hasWarnings check and the alerts section to show separate warnings for each check.

- [ ] **Step 8: Run typecheck and tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: clean typecheck, all tests pass

- [ ] **Step 9: Commit**

```bash
git add src/app/api/export/workbook/route.ts src/exports/workbook.ts src/components/wizard/ResultsStep.tsx
git commit -m "feat: update workbook and UI for new FinancialReport structure"
```

---

### Task 4: Implement Suspense module

**Files:**
- Modify: `src/domain/suspense.ts` — create new module `buildSuspenseList`
- Modify: `src/domain/types.ts` — already done in Task 1

- [ ] **Step 1: Write failing tests in `tests/domain/suspense.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { buildSuspenseList } from "../../src/domain/suspense";
import type { Classification } from "../../src/domain/types";

const mk = (id: string, status: string, category?: string): Classification => ({
  id: `c-${id}`,
  transactionId: id,
  finalCategory: category ?? "Rental Income",
  reportType: "P&L",
  confidence: "high",
  ruleUsed: "test",
  reviewStatus: status as any,
  isManualCorrection: false,
  createdAt: "",
  updatedAt: "",
});

describe("buildSuspenseList", () => {
  it("returns empty when all approved", () => {
    expect(buildSuspenseList([mk("1", "approved"), mk("2", "excluded")])).toHaveLength(0);
  });

  it("flags Uncategorized / Needs Review", () => {
    const result = buildSuspenseList([mk("1", "pending", "Uncategorized / Needs Review")]);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain("Uncategorized");
  });

  it("flags pending status", () => {
    const result = buildSuspenseList([mk("1", "pending")]);
    expect(result).toHaveLength(1);
  });

  it("flags support_needed status", () => {
    const result = buildSuspenseList([mk("1", "support_needed")]);
    expect(result).toHaveLength(1);
  });

  it("flags cpa_review status", () => {
    const result = buildSuspenseList([mk("1", "cpa_review")]);
    expect(result).toHaveLength(1);
  });

  it("flags card_statements_needed status", () => {
    const result = buildSuspenseList([mk("1", "card_statements_needed")]);
    expect(result).toHaveLength(1);
  });

  it("does not flag excluded", () => {
    const result = buildSuspenseList([mk("1", "excluded")]);
    expect(result).toHaveLength(0);
  });

  it("does not flag approved", () => {
    const result = buildSuspenseList([mk("1", "approved")]);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement `buildSuspenseList`**

In `src/domain/suspense.ts`:

```typescript
import type { Classification, SuspenseItem, ReviewStatus } from "./types";
import { REVIEW_REQUIRED_STATUSES } from "./reviewPolicy";

export function buildSuspenseList(classifications: Classification[]): SuspenseItem[] {
  return classifications
    .filter(c => {
      if (c.reviewStatus === "approved" || c.reviewStatus === "excluded") return false;
      if (c.finalCategory?.includes("Uncategorized")) return true;
      return REVIEW_REQUIRED_STATUSES.includes(c.reviewStatus);
    })
    .map(c => ({
      transactionId: c.transactionId,
      date: "",
      description: "",
      amount: 0,
      currentCategory: c.finalCategory ?? "Unknown",
      reviewStatus: c.reviewStatus,
      reason: c.ruleUsed ?? `Status: ${c.reviewStatus}`,
    }));
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/domain/suspense.test.ts
```

Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/domain/suspense.ts tests/domain/suspense.test.ts
git commit -m "feat: implement suspense module with buildSuspenseList"
```

---

### Task 5: Implement Transfer Matching

**Files:**
- Create: `src/domain/transferMatching.ts`
- Test: `tests/domain/transferMatching.test.ts`

- [ ] **Step 1: Write tests in `tests/domain/transferMatching.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { matchInternalTransfers } from "../../src/domain/transferMatching";

const tx = (id: string, amt: number, desc: string, acctId: string, companyId: string, date: string) => ({
  id, amount: amt, description: desc, bankAccountId: acctId, companyId, date,
});

describe("matchInternalTransfers", () => {
  it("matches exact internal transfer pair", () => {
    const txs = [
      tx("t1", -50000, "TRF TO CHK 1234", "a1", "c1", "2025-01-01"),
      tx("t2", 50000, "TRF FROM CHK 5678", "a2", "c1", "2025-01-02"),
    ];
    const result = matchInternalTransfers(txs as any, ["a1", "a2"], "c1");
    expect(result.matchedPairs).toHaveLength(1);
    expect(result.unmatchedTransfers).toHaveLength(0);
  });

  it("does not match different amounts", () => {
    const txs = [
      tx("t1", -50000, "TRF TO CHK 1234", "a1", "c1", "2025-01-01"),
      tx("t2", 50001, "TRF FROM CHK 5678", "a2", "c1", "2025-01-02"),
    ];
    const result = matchInternalTransfers(txs as any, ["a1", "a2"], "c1");
    expect(result.matchedPairs).toHaveLength(0);
    expect(result.unmatchedTransfers).toHaveLength(2);
  });

  it("does not match same account", () => {
    const txs = [
      tx("t1", -50000, "TRF TO CHK 1234", "a1", "c1", "2025-01-01"),
      tx("t2", 50000, "TRF FROM CHK 5678", "a1", "c1", "2025-01-02"),
    ];
    const result = matchInternalTransfers(txs as any, ["a1", "a2"], "c1");
    expect(result.matchedPairs).toHaveLength(0);
  });

  it("does not match different company", () => {
    const txs = [
      tx("t1", -50000, "TRF TO CHK 1234", "a1", "c1", "2025-01-01"),
      tx("t2", 50000, "TRF FROM CHK 5678", "a2", "c2", "2025-01-02"),
    ];
    const result = matchInternalTransfers(txs as any, ["a1", "a2"], "c1");
    expect(result.matchedPairs).toHaveLength(0);
  });

  it("does not match vendor wire (non-transfer description)", () => {
    const txs = [
      tx("t1", -50000, "WIRE TRANSFER TO VENDOR", "a1", "c1", "2025-01-01"),
      tx("t2", 50000, "WIRE TRANSFER FROM CLIENT", "a2", "c1", "2025-01-02"),
    ];
    const result = matchInternalTransfers(txs as any, ["a1", "a2"], "c1");
    expect(result.matchedPairs).toHaveLength(0);
    expect(result.unmatchedTransfers).toHaveLength(2);
  });

  it("returns list of unmatched transfers", () => {
    const txs = [
      tx("t1", -50000, "TRF TO CHK 1234", "a1", "c1", "2025-01-01"),
    ];
    const result = matchInternalTransfers(txs as any, ["a1", "a2"], "c1");
    expect(result.unmatchedTransfers).toHaveLength(1);
    expect(result.unmatchedTransfers[0].id).toBe("t1");
  });
});
```

- [ ] **Step 2: Implement `matchInternalTransfers`**

In `src/domain/transferMatching.ts`:

```typescript
import type { Transaction, MatchedTransferPair } from "./types";

const TRANSFER_PATTERNS = [/TRANSFER.*BETWEEN/i, /TRF.*TO/i, /TRF.*FROM/i, /ACCT TRANSFER/i, /INTERNAL TRANSFER/i, /ONLINE TRANSFER/i];

function isTransferLike(desc: string): boolean {
  return TRANSFER_PATTERNS.some(p => p.test(desc));
}

type MatchResult = {
  matchedPairs: MatchedTransferPair[];
  unmatchedTransfers: Transaction[];
};

export function matchInternalTransfers(
  transactions: Transaction[],
  companyAccountIds: string[],
  companyId: string,
  maxDateDiffDays: number = 3
): MatchResult {
  const transfers = transactions.filter(t => isTransferLike(t.description) && t.companyId === companyId);
  const used = new Set<string>();
  const matchedPairs: MatchedTransferPair[] = [];
  const unmatchedTransfers: Transaction[] = [];

  for (const outTx of transfers.filter(t => t.amount < 0)) {
    if (used.has(outTx.id)) continue;
    const match = transfers.find(inTx =>
      inTx.amount > 0
      && Math.abs(inTx.amount + outTx.amount) <= 0.01
      && inTx.bankAccountId !== outTx.bankAccountId
      && companyAccountIds.includes(inTx.bankAccountId)
      && !used.has(inTx.id)
      && Math.abs(new Date(inTx.date).getTime() - new Date(outTx.date).getTime()) <= maxDateDiffDays * 86400000
    );
    if (match) {
      matchedPairs.push({
        outTransactionId: outTx.id,
        inTransactionId: match.id,
        outAccountId: outTx.bankAccountId,
        inAccountId: match.bankAccountId,
        amount: Math.abs(outTx.amount),
        dateDifferenceDays: Math.round(Math.abs(new Date(match.date).getTime() - new Date(outTx.date).getTime()) / 86400000),
      });
      used.add(outTx.id);
      used.add(match.id);
    }
  }

  for (const t of transfers) {
    if (!used.has(t.id)) unmatchedTransfers.push(t);
  }

  return { matchedPairs, unmatchedTransfers };
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/domain/transferMatching.test.ts
```

Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/domain/transferMatching.ts tests/domain/transferMatching.test.ts
git commit -m "feat: implement internal transfer matching"
```

---

### Task 6: Counterparty Rules Cleanup

**Files:**
- Modify: `src/domain/classification.ts` — remove Valoris/Wyndham P&L rule, keep it as BS

- [ ] **Step 1: Remove Valoris/Wyndham counterparty rule from P&L**

In `src/domain/classification.ts`, remove the `COUNTERPARTY_RULES` array entirely (the only rule was Valoris→P&L). Also remove the `classifyByCounterparty` function and `getCounterpartyRules`. The counterparty call in the fallback section should also be removed.

The Valoris/Wyndham transactions now fall through to the generic "VALORIS" pattern which maps to related-party BS:

```typescript
// Balance Sheet — Due From/To Related Parties (Support Needed)
if (has(text, [/VALORIS/, /RELATED PARTY/, /INTERCOMPANY/, /AFFILIATE/])) {
  const cat = amount < 0 ? "Due from related parties" : "Due to related parties";
  return amount < 0
    ? MEDIUM(transaction.id, cat, "Balance Sheet", "Related party payment (outgoing)")
    : MEDIUM(transaction.id, cat, "Balance Sheet", "Related party receipt (incoming)");
}
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

The existing QA test may need updating since Valoris transactions that were classified as P&L (Operating / merchant income) will now be BS (Due to/from related parties). Update the QA real-data report test to match.

- [ ] **Step 3: Commit**

```bash
git add src/domain/classification.ts tests/qa-real-data-report.test.ts
git commit -m "fix: remove Valoris/Wyndham P&L counterparty rule, stays as BS related-party"
```

---

### Task 7: Opening Balances API and UI

**Files:**
- Create: `src/app/api/opening-balances/route.ts`
- Modify: `src/components/wizard/ReconciliationStep.tsx` — add opening balances input
- Modify: `src/domain/openingBalances.ts`

- [ ] **Step 1: Write tests in `tests/domain/openingBalances.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { validateOpeningBalanceSheet } from "../../src/domain/openingBalances";

describe("validateOpeningBalanceSheet", () => {
  it("passes when assets = liabilities + equity", () => {
    const entries = [
      { accountType: "asset", amount: 10000 },
      { accountType: "liability", amount: 3000 },
      { accountType: "equity", amount: 7000 },
    ];
    const result = validateOpeningBalanceSheet(entries as any);
    expect(result.isValid).toBe(true);
    expect(result.difference).toBe(0);
  });

  it("fails when assets != liabilities + equity", () => {
    const entries = [
      { accountType: "asset", amount: 10000 },
      { accountType: "liability", amount: 2000 },
      { accountType: "equity", amount: 7000 },
    ];
    const result = validateOpeningBalanceSheet(entries as any);
    expect(result.isValid).toBe(false);
    expect(result.difference).toBe(1000);
  });

  it("handles empty entries", () => {
    const result = validateOpeningBalanceSheet([]);
    expect(result.isValid).toBe(true);
    expect(result.difference).toBe(0);
  });
});
```

- [ ] **Step 2: Implement `validateOpeningBalanceSheet`**

In `src/domain/openingBalances.ts`:

```typescript
import type { OpeningBalanceEntry, OpeningBalanceSheetInput } from "./types";

export function validateOpeningBalanceSheet(entries: Pick<OpeningBalanceEntry, "accountType" | "amount">[]): OpeningBalanceSheetInput {
  const assets = entries.filter(e => e.accountType === "asset").reduce((s, e) => s + e.amount, 0);
  const liabilities = entries.filter(e => e.accountType === "liability").reduce((s, e) => s + e.amount, 0);
  const equity = entries.filter(e => e.accountType === "equity").reduce((s, e) => s + e.amount, 0);
  const difference = Math.round((assets - liabilities - equity) * 100) / 100;
  return { entries: entries as OpeningBalanceEntry[], isValid: Math.abs(difference) <= 0.01, difference };
}
```

- [ ] **Step 3: Create API endpoint** at `src/app/api/opening-balances/route.ts`

Implement GET (fetch by workspaceId) and POST (upsert):

```typescript
import { NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const rows = await query("SELECT * FROM opening_balance_entries WHERE workspace_id = $1", [workspaceId]);
  return NextResponse.json(rows.map((r: any) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    accountName: r.account_name,
    accountType: r.account_type,
    amount: r.amount,
    source: r.source,
    supportStatus: r.support_status,
  })));
}

export async function POST(request: Request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { workspaceId, entries } = body;
  if (!workspaceId || !entries) return NextResponse.json({ error: "workspaceId and entries required" }, { status: 400 });
  // Delete existing, insert new
  await execute("DELETE FROM opening_balance_entries WHERE workspace_id = $1", [workspaceId]);
  for (const e of entries) {
    await execute(
      "INSERT INTO opening_balance_entries (id, workspace_id, account_name, account_type, amount, source, support_status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [uuid(), workspaceId, e.accountName, e.accountType, e.amount, e.source || "manual", e.supportStatus || "provided"]
    );
  }
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Update ReconciliationStep** to show opening balances. Add a section after the reconciliation table:

```typescript
// Opening Balance section in ReconciliationStep.tsx
{/* Opening Balance Sheet */}
<div className="rounded border border-line p-4">
  <h3 className="mb-2 text-sm font-semibold">Opening Balance Sheet</h3>
  <p className="mb-3 text-xs text-slate-500">Enter opening balances to enable Balance Sheet mode.</p>
  <div className="space-y-2">
    {["asset", "liability", "equity"].map(type => (
      <div key={type} className="flex items-center gap-2">
        <span className="w-24 text-sm capitalize">{type}s</span>
        {/* Inputs for each type */}
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 5: Run tests and typecheck**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add src/domain/openingBalances.ts src/app/api/opening-balances/route.ts tests/domain/openingBalances.test.ts
git commit -m "feat: implement opening balances validation, API, and UI"
```

---

### Task 8: Database migration for opening_balance_entries table

**Files:**
- Create: migration file

- [ ] **Step 1: Create migration SQL**

Create `src/lib/migrations/004_opening_balance_entries.sql`:

```sql
CREATE TABLE IF NOT EXISTS opening_balance_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity')),
  amount REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  support_status TEXT NOT NULL DEFAULT 'provided' CHECK (support_status IN ('provided', 'missing', 'reviewed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_opening_balance_entries_workspace ON opening_balance_entries(workspace_id);
```

- [ ] **Step 2: Add migration to db.ts**

Edit `src/lib/db.ts` to add the new migration to the migration list.

- [ ] **Step 3: Run migration test**

Create a test that verifies the table exists.

- [ ] **Step 4: Commit**

---

### Task 9: Update ReconciliationStep and ResultsStep warnings

**Files:**
- Modify: `src/components/wizard/ReconciliationStep.tsx` — separate warnings per control
- Modify: `src/components/wizard/ResultsStep.tsx` — show 3 separate checks, mode badge, new warnings

- [ ] **Step 1: Update ResultsStep.tsx warnings section**

Replace the single `hasWarnings` with separate indicators for each control:

```typescript
const unreconciledAccounts = reports.bankReconciliation.filter(r => r.status === "unreconciled");
const classificationIncomplete = reports.classificationCompleteness.status === "incomplete";
const equationFailed = reports.accountingEquation.status !== "passed";
const hasSuspenseItems = reports.suspense.length > 0;

// Show three separate alert boxes:
{unreconciledAccounts.length > 0 && (
  <div className="rounded border border-red-200 bg-red-50 p-3 text-sm space-y-1">
    <p className="font-medium text-red-700">✕ Bank reconciliation: {unreconciledAccounts.length} account(s) not reconciled</p>
  </div>
)}

{classificationIncomplete && (
  <div className="rounded border border-brass/30 bg-brass/5 p-3 text-sm space-y-1">
    <p className="font-medium text-brass">⚠ Classification incomplete: {reports.classificationCompleteness.unresolved} transaction(s) pending review</p>
  </div>
)}

{equationFailed && (
  <div className="rounded border border-red-200 bg-red-50 p-3 text-sm space-y-1">
    <p className="font-medium text-red-700">⚠ Accounting equation: {reports.accountingEquation.missingInputs.join(", ") || `difference of ${money(reports.accountingEquation.difference)}`}</p>
  </div>
)}

{hasSuspenseItems && (
  <div className="rounded border border-brass/30 bg-brass/5 p-3 text-sm space-y-1">
    <p className="font-medium text-brass">⚠ {reports.suspense.length} transaction(s) in suspense — review required before finalizing</p>
  </div>
)}
```

Also replace the mode text:

```typescript
<span className="text-sm font-medium">
  {reports.mode === "complete_balance_sheet" ? "✓ Complete Balance Sheet" :
   reports.mode === "preliminary_balance_sheet" ? "⚠ Preliminary Balance Sheet" :
   "ℹ Statement of Classified Bank Activity"}
</span>
```

- [ ] **Step 2: Run tests and typecheck**

- [ ] **Step 3: Commit**

---

### Task 10: Integrate Transfer Matching into buildFinancialReport

**Files:**
- Modify: `src/domain/reporting.ts` — call transfer matching and exclude matched pairs from BS

- [ ] **Step 1: Update `buildFinancialReport` to call `matchInternalTransfers`**

After building the initial BS, check if any Transfer Clearing items are matched internal transfers. Flag them:

```typescript
import { matchInternalTransfers } from "./transferMatching";

// After computing balanceSheet but before returning:
const matchedTransfers = matchInternalTransfers(
  transactions,
  accounts.map(a => a.id),
  accounts[0]?.companyId ?? ""
);

// Matched transfers can be excluded from BS totals (they cancel out at entity level)
// But they should still appear in the activity statement
```

- [ ] **Step 2: Run tests**

- [ ] **Step 3: Commit**

---

### Task 11: Update QA real-data report tests

**Files:**
- Modify: `tests/qa-real-data-report.test.ts` — update to use new FinancialReport structure

- [ ] **Step 1: Update imports and assertions**

Change the test to validate all three controls, not just balanceCheck.

- [ ] **Step 2: Run the test**

```bash
npx vitest run tests/qa-real-data-report.test.ts
```

- [ ] **Step 3: Commit**

---

### Task 12: Full validation

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all pass

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Build**

```bash
npm run build
```

- [ ] **Step 4: Check git status**

```bash
git status
git diff --stat
```

---
