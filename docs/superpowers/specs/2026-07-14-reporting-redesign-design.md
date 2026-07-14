# Redesign: Report Mode, Controls & Balance Sheet Honesty

**Date:** 2026-07-14
**Status:** Approved Design
**Audience:** Implementation

## Problem

The current `BalanceSheetReport` computes `balanceCheck = Assets − Liabilities − Equity` using raw classified bank movements. This never balances unless mirroring transactions exist, because:

- No "Cash" line item — cash movements are classified into BS categories but cash itself isn't tracked
- Credit card payments reduce liability but charges aren't imported
- Inter-account transfers net to zero in reality but show as assets
- Opening balances are not included
- The system implicitly conflates three separate controls into one number

## Principles

1. **Cash must come from real closing balances**, never be calculated as a plug
2. **Reconciliation, classification completeness, and accounting equation are three separate controls**
3. **Suspense is explicit and traceable** — never hidden, never counts as "complete"
4. **Three report modes** — the system must be honest about what it can and cannot produce
5. **Balance Sheet completeness requires opening balances** — cannot be declared complete without them
6. **Internal transfers only net when both sides are demonstrably matched**
7. **No artificial plugs** — never invent figures to make checks pass

## Architectural Changes

### 1. New Types (`src/domain/types.ts`)

```typescript
type CheckStatus = "passed" | "failed" | "incomplete_data";

type BankReconciliationCheck = {
  accountId: string;
  accountName: string;
  openingBalance: number;
  movementTotal: number;
  expectedClosingBalance: number;
  actualClosingBalance: number;
  variance: number;
  status: "reconciled" | "unreconciled";
};

type ClassificationCompletenessCheck = {
  totalTransactions: number;
  approved: number;
  excluded: number;
  unresolved: number;
  unresolvedAmount: number;
  suspenseAmount: number;
  status: "complete" | "incomplete";
};

type AccountingEquationCheck = {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  difference: number;
  status: CheckStatus;
  missingInputs: string[];
};

type FinancialReportMode = "classified_bank_activity" | "preliminary_balance_sheet" | "complete_balance_sheet";

type SuspenseItem = {
  transactionId: string;
  date: string;
  description: string;
  amount: number;
  currentCategory: string;
  reviewStatus: ReviewStatus;
  reason: string;
};

type FinancialReport = {
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
  actualCash: number;            // SUM of actual closing_balance
  expectedCash: number;          // SUM of opening + movements
  totalCashVariance: number;
};
```

Replace `ReportPackage` with `FinancialReport`. The old type can remain for backward compatibility but all consumers migrate to the new one.

### 2. Three Separate Controls (`src/domain/reporting.ts`)

New exports replacing `buildReports`:

- `buildBankReconciliation(accounts, transactionsByAccount) → BankReconciliationCheck[]`
- `buildClassificationCompleteness(classifications) → ClassificationCompletenessCheck`
- `buildAccountingEquation(assets, liabilities, equity, openingBalancesExist) → AccountingEquationCheck`
- `determineFinancialReportMode(checks, openingBalancesExist, hasSuspense, hasCardStatementsNeeded) → { mode, reasons }`
- `buildFinancialReport(entityName, taxYear, accounts, transactions, classifications) → FinancialReport`

#### AccountingEquationCheck logic

```typescript
difference = totalAssets - totalLiabilities - totalEquity

const missingInputs = [];
if (!openingBalancesExist) missingInputs.push("Opening Balance Sheet not provided");
if (hasSuspense) missingInputs.push("Unresolved suspense entries");
if (hasCardStatementsNeeded) missingInputs.push("Credit card statements not imported");

if (missingInputs.length > 0) {
  status = "incomplete_data";
} else if (Math.abs(difference) <= 0.01) {
  status = "passed";
} else {
  status = "failed";
}
```

#### determineFinancialReportMode

```typescript
if (openingBalancesExist && !hasSuspense && !hasCardStatementsNeeded
    && allAccountsReconciled && equationStatus === "passed" && classificationStatus === "complete") {
  mode = "complete_balance_sheet";
} else if (openingBalancesExist || hasSuspense || hasCardStatementsNeeded) {
  mode = "preliminary_balance_sheet";
} else {
  mode = "classified_bank_activity";
}
```

### 3. Cash from Real Balances

`actualCash = SUM(bank_accounts.closing_balance)`

Displayed alongside:
- `expectedCash = SUM(opening_balance) + SUM(imported movement)`
- `totalCashVariance = actualCash - expectedCash`

Cash is never used as a balancing plug.

### 4. Suspense (`src/domain/suspense.ts`)

New module. A transaction is in suspense if:
- `reviewStatus === "pending"` or
- `finalCategory === "Uncategorized / Needs Review"` or
- `reviewStatus === "support_needed"` (optional, per CPA discretion)

Suspense items:
- Appear in Review Exceptions
- Appear in CPA memo
- Appear in a new "Suspense Detail" worksheet
- Block `complete_balance_sheet` mode
- Are traceable to individual transaction IDs
- Are not counted as "classification complete"

### 5. Three Report Modes

#### Mode 1: Statement of Classified Bank Activity
When no opening balances exist. Title: "Statement of Classified Bank Activity — For the period ended [date]". Shows cash inflows/outflows, P&L classifications, BS-related classifications, transfers, suspense, reconciliation, pending documentation.

#### Mode 2: Preliminary Balance Sheet
When some opening balances exist but conditions for complete are not met. Title: "Preliminary Balance Sheet — Incomplete". Includes list of missing inputs. Cannot be presented as final.

#### Mode 3: Complete Balance Sheet
Only when ALL conditions met: opening balances complete, classification complete, all accounts reconciled, no suspense, equation passed, CPA review completed.

### 6. Workbook Redesign (`src/exports/workbook.ts`)

Sheets in order:
1. **Report Status** — table with all checks (reconciliation, classification, equation, opening balances, card statements)
2. **P&L** — same as current but with mode-appropriate title
3. **Classified Bank Activity** — only when mode !== complete_balance_sheet
4. **Balance Sheet** — only when mode !== classified_bank_activity
5. **Reconciliation** — per-account table
6. **Suspense Detail** — all unresolved items with traceability

### 7. Transfer Matching (`src/domain/transferMatching.ts`)

New module: `matchInternalTransfers(transactions, accounts)`:

```typescript
type MatchedTransfer = {
  outTransactionId: string;
  inTransactionId: string;
  outAccountId: string;
  inAccountId: string;
  amount: number;
  dateDifference: number;
};
```

Rules:
- Accounts must be different
- Both accounts must belong to the same company
- Amounts must be opposite signs, absolute difference <= 0.01
- Dates within a configurable window (default 3 days)
- Both transactions must not already be matched
- Pattern must be transfer-like (description contains transfer keywords)

Unmatched transfers stay in their classified BS category. The Valoris → P&L counterparty rule was removed; intercompany/related-party stays BS.

### 8. Opening Balances (`src/domain/openingBalances.ts` and UI)

- New type `OpeningBalanceEntry` with account name, type (asset/liability/equity), amount, source, supportStatus
- New API endpoints: `GET /api/opening-balances?workspaceId=X`, `POST /api/opening-balances` (upsert)
- New UI section in wizard (OpeningBalancesStep or inline in ReconciliationStep)
- Validation: opening Assets − opening Liabilities − opening Equity === 0 (within tolerance)
- If validation fails, block complete_balance_sheet mode

### 9. Counterparty Rules Update

- Valoris/Wyndham rule removed from P&L — intercompany/related-party stays BS
- Transfer matching replaces the need for entity-specific counterparty rules for transfers

## Implementation Order

1. **Types** — add all new types to `src/domain/types.ts`, update existing where needed
2. **Three controls** — implement `buildBankReconciliation`, `buildClassificationCompleteness`, `buildAccountingEquation`
3. **determineFinancialReportMode** + `buildFinancialReport` 
4. **Cash from real balances** — update reporting to read closing_balance from accounts
5. **Suspense module** — implement `src/domain/suspense.ts`
6. **Transfer matching** — implement `src/domain/transferMatching.ts`
7. **Opening balances** — types, API, UI
8. **Workbook redesign** — new sheets, mode-appropriate titles, warnings
9. **UI updates** — ReconciliationStep, ResultsStep, ReviewStep
10. **Counterparty rules cleanup** — remove Valoris→P&L, keep BS
11. **Tests** — all scenarios per spec
12. **Validation** — typecheck, build, test, E2E
13. **Deploy preview** — Vercel preview for three scenarios

## Test Scenarios

| # | Scenario | Expected Mode | Bank Recon | Class Complete | Equation |
|---|---|---|---|---|---|
| A | Only bank activity, no opening BS | classified_bank_activity | depends | depends | incomplete_data |
| B | Some opening balances, card statements needed | preliminary_balance_sheet | depends | incomplete | incomplete_data |
| C | Full opening BS, all reconciled, no suspense, CPA reviewed | complete_balance_sheet | reconciled | complete | passed |

## Open Questions

None. Full spec provided by domain expert (CPA).
