# Annual CPA Package MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working vertical slice of the Valoris annual CPA package app: LLC/year workspace, document checklist, normalized transactions, conservative classification, reconciliation checks, three-tab workbook export, and CPA memo export.

**Architecture:** Start with a Next.js TypeScript app and a pure domain layer that can be tested without UI. The first slice uses in-memory/local browser state so the workflow is usable immediately, while domain interfaces keep Supabase/WebLLM integration clean for later plans.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, shadcn-style components, Vitest, Testing Library, ExcelJS for `.xlsx`, docx for CPA memo generation, Papa Parse for CSV parsing.

## Global Constraints

- Product is scoped to annual CPA packages for Valoris LLCs before generalizing to external SaaS users.
- Final CPA workbook must have exactly three visible tabs: `Transaction Detail`, `P&L <year>`, and `Balance Sheet`.
- P&L and Balance Sheet values must be formulas from `Transaction Detail`.
- P&L and Balance Sheet must use the sober Valoris style: no colors, no notes, no borders, and no gridlines.
- Do not calculate partner tax basis, tax capital, at-risk basis, or final K-1 allocations.
- Contributions, distributions, loans, transfers, investments, credit-card payments, and unclear items must stay out of P&L unless supported as real income or expense.
- Uncertainty belongs in `Review Status`, not in slash-combined account names.
- Missing documents do not block draft work, but must appear in the CPA memo.
- `Balance Check` must be zero or explained in the CPA memo before package completion.
- No external AI inference in MVP.

---

## File Structure

- `package.json`: scripts and dependencies.
- `src/domain/types.ts`: shared domain types.
- `src/domain/chartOfAccounts.ts`: Valoris CPA-presentable account names and document checklist constants.
- `src/domain/classification.ts`: deterministic classification rules and review status handling.
- `src/domain/reconciliation.ts`: account-period reconciliation and balance-check logic.
- `src/domain/reporting.ts`: P&L and balance sheet aggregation.
- `src/domain/cpaPackage.ts`: package completeness and CPA memo data model.
- `src/domain/importCsv.ts`: CSV normalization from uploaded statement rows.
- `src/exports/workbook.ts`: exact three-tab workbook export.
- `src/exports/cpaMemo.ts`: CPA memo `.docx` export.
- `src/app/page.tsx`: single-screen vertical slice workflow.
- `src/app/api/export/workbook/route.ts`: workbook download endpoint.
- `src/app/api/export/memo/route.ts`: memo download endpoint.
- `tests/domain/*.test.ts`: unit tests for accounting rules, reconciliation, reporting, and package status.
- `tests/exports/*.test.ts`: export structure tests.

---

### Task 1: Scaffold App and Test Harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: `npm run test`, `npm run lint`, `npm run dev`, `npm run build`.

- [ ] **Step 1: Create project configuration**

Create the listed files with this minimum configuration:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "@testing-library/react": "^16.0.0",
    "docx": "^9.5.0",
    "exceljs": "^4.4.0",
    "next": "^15.0.0",
    "papaparse": "^5.4.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/papaparse": "^5.3.14",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Add smoke test**

```ts
import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("runs", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm install && npm run test`

Expected: smoke test passes.

- [ ] **Step 4: Commit**

```bash
git add package.json tsconfig.json next.config.ts postcss.config.mjs tailwind.config.ts vitest.config.ts src/app/layout.tsx src/app/globals.css tests/smoke.test.ts
git commit -m "chore: scaffold annual cpa package app"
```

---

### Task 2: Domain Types and Constants

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/chartOfAccounts.ts`
- Create: `tests/domain/chartOfAccounts.test.ts`

**Interfaces:**
- Produces: `DocumentChecklistItem`, `Transaction`, `ClassificationResult`, `StatementKind`, `ReviewStatus`, `CpaPackage`, `VALORIS_DOCUMENT_CHECKLIST`, `CPA_ACCOUNT_NAMES`.

- [ ] **Step 1: Write tests for required checklist and account names**

```ts
import { describe, expect, it } from "vitest";
import { CPA_ACCOUNT_NAMES, VALORIS_DOCUMENT_CHECKLIST } from "../../src/domain/chartOfAccounts";

describe("Valoris constants", () => {
  it("contains the eight required CPA package folders", () => {
    expect(VALORIS_DOCUMENT_CHECKLIST.map((item) => item.folder)).toEqual([
      "01 Entity Documents",
      "02 Prior-Year Tax Returns",
      "03 K-1s Received",
      "04 Bank Statements",
      "05 IRS and State Notices",
      "06 Financial Statements",
      "07 Other Support",
      "08 CPA Memo"
    ]);
  });

  it("uses CPA-presentable account names without slash-combined uncertainty", () => {
    expect(CPA_ACCOUNT_NAMES.every((name) => !name.includes("/"))).toBe(true);
  });
});
```

- [ ] **Step 2: Implement types and constants**

Define string unions for `StatementKind = "P&L" | "Balance Sheet"` and `ReviewStatus = "" | "Support Needed" | "CPA Review" | "Credit Card Statements Needed" | "Missing Document" | "Unresolved Delta" | "Potential Related Party"`.

Create `VALORIS_DOCUMENT_CHECKLIST` with the eight SOP folders and `CPA_ACCOUNT_NAMES` including `Rental Income`, `Bank fees`, `Legal and accounting`, `Interest expense`, `Capital contributions`, `Member distributions`, `Credit card payable`, `Due from related parties`, `Due to related parties`, `Transfer clearing`, `Investment in partnerships`, `Loan payable`, and `Current year net income`.

- [ ] **Step 3: Run tests**

Run: `npm run test -- tests/domain/chartOfAccounts.test.ts`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain/types.ts src/domain/chartOfAccounts.ts tests/domain/chartOfAccounts.test.ts
git commit -m "feat: add Valoris CPA package domain constants"
```

---

### Task 3: Conservative Classification Engine

**Files:**
- Create: `src/domain/classification.ts`
- Create: `tests/domain/classification.test.ts`

**Interfaces:**
- Consumes: `Transaction`, `ClassificationResult`, `ReviewStatus`.
- Produces: `classifyTransaction(transaction: Transaction): ClassificationResult`.

- [ ] **Step 1: Write classification tests**

```ts
import { describe, expect, it } from "vitest";
import { classifyTransaction } from "../../src/domain/classification";
import type { Transaction } from "../../src/domain/types";

const tx = (description: string, amount: number): Transaction => ({
  id: crypto.randomUUID(),
  date: "2025-01-15",
  sourceAccount: "Chase Operating",
  description,
  amount,
  sourceCategory: "",
  type: "",
  sourceBalance: null,
  sourceFile: "jan.csv"
});

describe("classifyTransaction", () => {
  it("keeps owner contributions off P&L", () => {
    expect(classifyTransaction(tx("CAPITAL CONTRIBUTION OWNER", 50000))).toMatchObject({
      statement: "Balance Sheet",
      finalCategory: "Capital contributions",
      pnlAmount: 0
    });
  });

  it("keeps credit card payments off P&L and requests card statements", () => {
    expect(classifyTransaction(tx("AUTOPAY AMEX PAYMENT", -3000))).toMatchObject({
      statement: "Balance Sheet",
      bsLine: "Credit card payable",
      reviewStatus: "Credit Card Statements Needed"
    });
  });

  it("routes K-1 items to CPA Review", () => {
    expect(classifyTransaction(tx("K-1 income from investment LLC", 2500))).toMatchObject({
      statement: "Balance Sheet",
      reviewStatus: "CPA Review"
    });
  });
});
```

- [ ] **Step 2: Implement deterministic classification**

Implement rules in this order: K-1/tax-specific items, credit-card payments, owner/member contributions, owner/member distributions, related-party transfers, investments/capital calls, loan principal/proceeds, interest, bank fees, legal/accounting, rental/fee income, fallback to Balance Sheet `Transfer clearing` with `CPA Review`.

- [ ] **Step 3: Run tests**

Run: `npm run test -- tests/domain/classification.test.ts`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain/classification.ts tests/domain/classification.test.ts
git commit -m "feat: add conservative transaction classification"
```

---

### Task 4: CSV Normalization

**Files:**
- Create: `src/domain/importCsv.ts`
- Create: `tests/domain/importCsv.test.ts`

**Interfaces:**
- Produces: `normalizeCsvRows(csv: string, sourceAccount: string, sourceFile: string): Transaction[]`.

- [ ] **Step 1: Write CSV normalization test**

```ts
import { describe, expect, it } from "vitest";
import { normalizeCsvRows } from "../../src/domain/importCsv";

describe("normalizeCsvRows", () => {
  it("normalizes date, description, amount, and source metadata", () => {
    const csv = "Date,Description,Amount,Balance\n01/05/2025,BANK FEE,-12.00,9988.00";
    expect(normalizeCsvRows(csv, "Chase Operating", "jan.csv")[0]).toMatchObject({
      date: "2025-01-05",
      sourceAccount: "Chase Operating",
      description: "BANK FEE",
      amount: -12,
      sourceBalance: 9988,
      sourceFile: "jan.csv"
    });
  });
});
```

- [ ] **Step 2: Implement normalizer**

Use Papa Parse with header mode. Support column aliases: `Date`, `Transaction Date`; `Description`, `Memo`, `Details`; `Amount`; or `Debit` plus `Credit`; `Balance`, `Running Balance`.

- [ ] **Step 3: Run tests**

Run: `npm run test -- tests/domain/importCsv.test.ts`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain/importCsv.ts tests/domain/importCsv.test.ts
git commit -m "feat: normalize bank csv transactions"
```

---

### Task 5: Reconciliation and Balance Check

**Files:**
- Create: `src/domain/reconciliation.ts`
- Create: `tests/domain/reconciliation.test.ts`

**Interfaces:**
- Produces: `reconcileAccountPeriod(openingBalance: number, closingBalance: number, transactions: Transaction[]): ReconciliationResult` and `calculateBalanceCheck(report: BalanceSheetReport): number`.

- [ ] **Step 1: Write reconciliation tests**

```ts
import { describe, expect, it } from "vitest";
import { reconcileAccountPeriod } from "../../src/domain/reconciliation";

describe("reconcileAccountPeriod", () => {
  it("marks a period reconciled when opening plus movement equals closing", () => {
    const result = reconcileAccountPeriod(1000, 1250, [
      { id: "1", date: "2025-01-01", sourceAccount: "Bank", description: "Rent", amount: 300, sourceCategory: "", type: "", sourceBalance: null, sourceFile: "jan.csv" },
      { id: "2", date: "2025-01-02", sourceAccount: "Bank", description: "Fee", amount: -50, sourceCategory: "", type: "", sourceBalance: null, sourceFile: "jan.csv" }
    ]);
    expect(result).toEqual({ movementTotal: 250, expectedClosingBalance: 1250, variance: 0, status: "reconciled" });
  });
});
```

- [ ] **Step 2: Implement reconciliation**

Round currency math to cents. Return `status: "reconciled"` only when absolute variance is less than or equal to `0.01`; otherwise return `status: "unreconciled"`.

- [ ] **Step 3: Run tests**

Run: `npm run test -- tests/domain/reconciliation.test.ts`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain/reconciliation.ts tests/domain/reconciliation.test.ts
git commit -m "feat: add account reconciliation checks"
```

---

### Task 6: Reporting Aggregation

**Files:**
- Create: `src/domain/reporting.ts`
- Create: `tests/domain/reporting.test.ts`

**Interfaces:**
- Consumes: classified transactions.
- Produces: `buildReports(entityName: string, taxYear: number, classifications: ClassifiedTransaction[]): ReportPackage`.

- [ ] **Step 1: Write reporting tests**

```ts
import { describe, expect, it } from "vitest";
import { buildReports } from "../../src/domain/reporting";

describe("buildReports", () => {
  it("keeps balance-sheet activity out of P&L", () => {
    const reports = buildReports("Demo LLC", 2025, [
      { transactionId: "1", amount: 1000, finalCategory: "Rental Income", statement: "P&L", pnlLine: "Rental Income", pnlAmount: 1000, bsLine: "", bsCounterpartAmount: 0, reviewStatus: "" },
      { transactionId: "2", amount: 5000, finalCategory: "Capital contributions", statement: "Balance Sheet", pnlLine: "", pnlAmount: 0, bsLine: "Capital contributions", bsCounterpartAmount: 5000, reviewStatus: "" }
    ]);
    expect(reports.pnl.netIncome).toBe(1000);
    expect(reports.balanceSheet.equity["Capital contributions"]).toBe(5000);
  });
});
```

- [ ] **Step 2: Implement aggregation**

Aggregate income and expenses separately. Expenses display positive on P&L. Balance sheet lines aggregate `bsCounterpartAmount`.

- [ ] **Step 3: Run tests**

Run: `npm run test -- tests/domain/reporting.test.ts`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain/reporting.ts tests/domain/reporting.test.ts
git commit -m "feat: aggregate CPA package reports"
```

---

### Task 7: CPA Package Status and Memo Data

**Files:**
- Create: `src/domain/cpaPackage.ts`
- Create: `tests/domain/cpaPackage.test.ts`

**Interfaces:**
- Produces: `buildCpaPackageStatus(pkg: CpaPackage): CpaPackageStatus` and `buildMemoModel(pkg: CpaPackage, classifications: ClassifiedTransaction[]): CpaMemoModel`.

- [ ] **Step 1: Write package status tests**

```ts
import { describe, expect, it } from "vitest";
import { buildCpaPackageStatus } from "../../src/domain/cpaPackage";

describe("buildCpaPackageStatus", () => {
  it("requires missing documents to be listed in the memo before completion", () => {
    const status = buildCpaPackageStatus({
      llcName: "Demo LLC",
      taxYear: 2025,
      checklist: [{ folder: "03 K-1s Received", label: "K-1s received", status: "Missing", memoNote: "" }],
      reviewerApproved: false,
      balanceCheckExplanation: ""
    });
    expect(status.canCompletePackage).toBe(false);
    expect(status.blockers).toContain("Missing documents must be listed in CPA memo.");
  });
});
```

- [ ] **Step 2: Implement package status**

Completion requires no unlisted missing documents, no unexplained non-zero balance check, and reviewer approval. Draft work remains allowed regardless of checklist status.

- [ ] **Step 3: Run tests**

Run: `npm run test -- tests/domain/cpaPackage.test.ts`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain/cpaPackage.ts tests/domain/cpaPackage.test.ts
git commit -m "feat: model CPA package completion status"
```

---

### Task 8: Three-Tab Workbook Export

**Files:**
- Create: `src/exports/workbook.ts`
- Create: `tests/exports/workbook.test.ts`

**Interfaces:**
- Produces: `buildWorkbookBuffer(input: WorkbookExportInput): Promise<Buffer>`.

- [ ] **Step 1: Write workbook export test**

```ts
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildWorkbookBuffer } from "../../src/exports/workbook";

describe("buildWorkbookBuffer", () => {
  it("creates exactly the three required visible tabs", async () => {
    const buffer = await buildWorkbookBuffer({ entityName: "Demo LLC", taxYear: 2025, transactions: [], reports: { pnl: { income: {}, expenses: {}, netIncome: 0 }, balanceSheet: { assets: {}, liabilities: {}, equity: {}, balanceCheck: 0 } } });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Transaction Detail", "P&L 2025", "Balance Sheet"]);
  });
});
```

- [ ] **Step 2: Implement workbook builder**

Create `Transaction Detail` columns A:N using the ZIP spec. Create P&L and Balance Sheet tabs with formulas referencing bounded `Transaction Detail` ranges. Set `views = [{ showGridLines: false }]` for P&L and Balance Sheet.

- [ ] **Step 3: Run tests**

Run: `npm run test -- tests/exports/workbook.test.ts`

Expected: workbook tab test passes.

- [ ] **Step 4: Commit**

```bash
git add src/exports/workbook.ts tests/exports/workbook.test.ts
git commit -m "feat: export three-tab CPA workbook"
```

---

### Task 9: CPA Memo Export

**Files:**
- Create: `src/exports/cpaMemo.ts`
- Create: `tests/exports/cpaMemo.test.ts`

**Interfaces:**
- Produces: `buildCpaMemoBuffer(model: CpaMemoModel): Promise<Buffer>`.

- [ ] **Step 1: Write memo export test**

```ts
import { describe, expect, it } from "vitest";
import { buildCpaMemoText } from "../../src/exports/cpaMemo";

describe("buildCpaMemoText", () => {
  it("includes missing documents and open CPA review items", () => {
    const text = buildCpaMemoText({
      llcName: "Demo LLC",
      taxYear: 2025,
      cpaName: "CPA",
      included: ["Financial workbook"],
      missingDocuments: ["K-1 from ABC LLC"],
      openReviewItems: ["Wire to related party requires support"]
    });
    expect(text).toContain("Missing documents:");
    expect(text).toContain("K-1 from ABC LLC");
    expect(text).toContain("Open CPA review items:");
  });
});
```

- [ ] **Step 2: Implement memo text and docx builder**

Create `buildCpaMemoText` for testable content and `buildCpaMemoBuffer` using `docx` paragraphs. Include the SOP notes that Valoris did not prepare K-1s, contributions/distributions were kept off P&L, and CPA should confirm final tax treatment.

- [ ] **Step 3: Run tests**

Run: `npm run test -- tests/exports/cpaMemo.test.ts`

Expected: memo content test passes.

- [ ] **Step 4: Commit**

```bash
git add src/exports/cpaMemo.ts tests/exports/cpaMemo.test.ts
git commit -m "feat: export CPA memo"
```

---

### Task 10: Single-Screen Workflow UI

**Files:**
- Create: `src/app/page.tsx`
- Create: `tests/app-page.test.tsx`

**Interfaces:**
- Consumes: domain functions from Tasks 2-9.
- Produces: usable first screen with LLC/year setup, checklist, CSV paste/import, classification table, reconciliation summary, package blockers, workbook export button, and memo export button.

- [ ] **Step 1: Write UI smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "../src/app/page";

describe("Annual CPA Package page", () => {
  it("shows the core workflow sections", () => {
    render(<Page />);
    expect(screen.getByText("Annual CPA Package")).toBeTruthy();
    expect(screen.getByText("Document Checklist")).toBeTruthy();
    expect(screen.getByText("Transaction Review")).toBeTruthy();
    expect(screen.getByText("Package Blockers")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement page**

Build a client component with local state. Use compact panels, tables, and buttons. Do not create a marketing landing page. Default entity name is `Valoris Demo LLC` and default tax year is `2025`.

- [ ] **Step 3: Run tests and build**

Run: `npm run test -- tests/app-page.test.tsx && npm run build`

Expected: tests pass and production build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx tests/app-page.test.tsx
git commit -m "feat: add annual CPA package workflow UI"
```

---

### Task 11: Export API Routes

**Files:**
- Create: `src/app/api/export/workbook/route.ts`
- Create: `src/app/api/export/memo/route.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `buildWorkbookBuffer`, `buildCpaMemoBuffer`.
- Produces: POST endpoints returning downloadable `.xlsx` and `.docx` files.

- [ ] **Step 1: Write route behavior tests**

Use unit-level tests for pure export builders from Tasks 8-9 as route confidence. API route integration can be added after the app build passes.

- [ ] **Step 2: Implement route handlers**

`POST /api/export/workbook` returns content type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

`POST /api/export/memo` returns content type `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.

- [ ] **Step 3: Wire UI download actions**

In `src/app/page.tsx`, add buttons that POST the current local package state and download files named `[LLC Name]_[Year]_PnL_BS_Detail.xlsx` and `[LLC Name]_[Year]_CPA_Memo.docx`.

- [ ] **Step 4: Run verification**

Run: `npm run test && npm run build`

Expected: all tests pass and build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/export/workbook/route.ts src/app/api/export/memo/route.ts src/app/page.tsx
git commit -m "feat: add CPA package export endpoints"
```

---

### Task 12: End-to-End Manual Verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: documented local verification path and known limitations.

- [ ] **Step 1: Add README workflow**

Document:

```md
# AI Financials for CPA Web

## Local run

npm install
npm run dev

Open http://localhost:3000.

## CPA package smoke scenario

1. Keep `Valoris Demo LLC` and `2025`.
2. Paste a CSV with rent income, bank fee, owner contribution, AMEX payment, and related-party transfer.
3. Import transactions.
4. Confirm owner contribution and AMEX payment are Balance Sheet items.
5. Confirm P&L excludes contributions, transfers, investments, and credit-card payments.
6. Confirm package blockers list missing memo support or reviewer approval.
7. Export workbook and confirm exactly three visible tabs.
8. Export CPA memo and confirm missing documents and open review items appear.
```

- [ ] **Step 2: Run final verification**

Run:

```bash
npm run test
npm run build
```

Expected: both commands pass.

- [ ] **Step 3: Start dev server**

Run: `npm run dev`

Expected: app available at `http://localhost:3000` or the next available port.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add CPA package smoke workflow"
```

---

## Self-Review

- Spec coverage: This plan covers annual CPA package workspace, document checklist, transaction normalization, conservative classification, reconciliation, reporting, three-tab workbook export, CPA memo export, and first usable UI. Supabase persistence, WebLLM, Google Drive automation, PDF extraction, and multi-user CPA collaboration are intentionally deferred to later implementation plans.
- Placeholder scan: This plan contains no placeholder red flags from the writing-plans checklist.
- Type consistency: Domain functions flow from `Transaction` to `ClassificationResult`, `ReportPackage`, workbook export, memo export, and UI.
