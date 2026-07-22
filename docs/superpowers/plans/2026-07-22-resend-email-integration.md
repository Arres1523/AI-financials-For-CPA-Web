# Resend Email Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email capabilities using Resend — welcome emails on signup and report delivery via email attachment.

**Architecture:** Install the `resend` npm package, create a shared client in `src/lib/resend.ts`, then add two API routes: one for welcome emails (triggered from auth callback) and one for report delivery (reusing existing export pipeline). Auth callback fires a fire-and-forget fetch to the welcome endpoint after session exchange.

**Tech Stack:** Next.js 15, TypeScript, Resend SDK, existing Supabase Auth session + pg pool.

## Global Constraints

- Node.js 24, pnpm 11.7, TypeScript strict mode
- Follow existing API route patterns (Next.js App Router, `requireUser()` for auth)
- No replacing Supabase Auth's built-in confirmation/password-reset emails
- Report attachments max 40MB per Resend limit
- Resend idempotency keys to prevent duplicate sends

---

### Task 1: Setup — Install Resend, env vars, client lib

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Create: `src/lib/resend.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `src/lib/resend.ts` — exports `getResend()` returning a `Resend` instance

- [ ] **Step 1: Install Resend**

Run: `pnpm add resend`

- [ ] **Step 2: Add env var to `.env.example`**

Add after the existing Supabase vars:

```
# Resend email API
RESEND_API_KEY=
```

- [ ] **Step 3: Create `src/lib/resend.ts`**

```typescript
import { Resend } from "resend";

let _client: Resend | null = null;

export function getResend(): Resend {
  if (_client) return _client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not configured");
  }
  _client = new Resend(apiKey);
  return _client;
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm run lint`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml .env.example src/lib/resend.ts
git commit -m "feat: add resend email client"
```

---

### Task 2: Welcome Email

**Files:**
- Create: `src/app/api/emails/welcome/route.ts`
- Modify: `src/app/auth/callback/route.ts`

**Interfaces:**
- Consumes: `getResend()` from Task 1, `requireUser()` from `@/lib/require-user`
- Produces: `POST /api/emails/welcome` — sends welcome email with idempotency key

- [ ] **Step 1: Create welcome email API route**

Create `src/app/api/emails/welcome/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResend } from "@/lib/resend";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.user_metadata?.welcome_sent) {
    return NextResponse.json({ sent: false, reason: "already_sent" });
  }

  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL ?? "Valoris <noreply@valoris.cpa>";

  const { error } = await resend.emails.send({
    from,
    to: [user.email],
    subject: "Welcome to Valoris — AI Financials for CPAs",
    html: `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
<h1 style="color: #FFD60A;">Welcome to Valoris</h1>
<p>Hi${user.user_metadata?.full_name ? " " + user.user_metadata.full_name : ""},</p>
<p>We're excited to have you on board. Valoris helps CPAs manage financial data — import bank statements, classify transactions, and generate financial reports.</p>
<p>To get started:</p>
<ul>
<li>Create a new workspace for your client</li>
<li>Import their bank statements</li>
<li>Review and classify transactions</li>
<li>Generate CPA-ready reports</li>
</ul>
<p style="color: #666; font-size: 0.875rem;">If you have any questions, reply to this email.</p>
</div>`,
  }, { idempotencyKey: `welcome-email/${user.id}` });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark welcome as sent in user metadata (fire-and-forget)
  await supabase.auth.updateUser({ data: { welcome_sent: true } }).catch(() => {});

  return NextResponse.json({ sent: true });
}
```

- [ ] **Step 2: Fire welcome email from auth callback**

Edit `src/app/auth/callback/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      fetch(`${origin}/api/emails/welcome`, { method: "POST" }).catch(() => {});
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm run lint`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/emails/welcome/route.ts src/app/auth/callback/route.ts
git commit -m "feat: send welcome email after auth callback"
```

---

### Task 3: Report Email

**Files:**
- Create: `src/app/api/emails/report/route.ts`
- Modify: `.env.example` (add `RESEND_FROM_EMAIL`)

**Interfaces:**
- Consumes: `getResend()` from Task 1, `requireUser()` from `@/lib/require-user`, `buildWorkbookBuffer` from `@/exports/workbook`, `buildCpaMemoBuffer` from `@/exports/cpaMemo`
- Produces: `POST /api/emails/report` — generates report and sends as email attachment

- [ ] **Step 1: Add optional RESEND_FROM_EMAIL to env**

Edit `.env.example`:

```
# Resend email API
RESEND_API_KEY=
RESEND_FROM_EMAIL=Valoris <noreply@valoris.cpa>
```

- [ ] **Step 2: Create report email API route**

The memo endpoint (`export/memo`) receives `CpaPackage` data from the request body (it's frontend state, not persisted). The workbook endpoint generates everything server-side from `workspaceId`. The email route mirrors both patterns:

```typescript
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { buildFinancialReport } from "@/domain/reporting";
import { buildWorkbookBuffer } from "@/exports/workbook";
import { buildCpaMemoBuffer } from "@/exports/cpaMemo";
import { buildMemoModel } from "@/domain/cpaPackage";
import type { CpaPackage, TransactionWithClassification } from "@/domain/types";
import { getResend } from "@/lib/resend";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json() as {
      recipientEmail: string;
      reportType: "workbook" | "memo";
      workspaceId?: string;
      includeTransactions?: boolean;
      pkg?: CpaPackage;
      transactions?: TransactionWithClassification[];
    };

    if (!body.recipientEmail || !body.reportType) {
      return NextResponse.json({ error: "recipientEmail and reportType required" }, { status: 400 });
    }

    let buffer: Buffer;
    let attachmentFilename: string;
    let companyName: string;
    let taxYear: number;

    if (body.reportType === "workbook") {
      if (!body.workspaceId) {
        return NextResponse.json({ error: "workspaceId required for workbook reports" }, { status: 400 });
      }
      const ws = await queryOne(`
        SELECT w.*, c.legal_name FROM workspaces w
        JOIN companies c ON c.id = w.company_id
        WHERE w.id = $1 AND w.user_id = $2
      `, [body.workspaceId, user.id]);
      if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

      companyName = ws.legal_name;
      taxYear = ws.tax_year;

      const txRows = await query(`
        SELECT t.*, c.final_category, c.report_type, c.confidence, c.rule_used, c.review_status
        FROM transactions t
        JOIN classifications c ON c.transaction_id = t.id
        WHERE t.workspace_id = $1 AND t.user_id = $2 AND c.review_status != 'excluded'
        ORDER BY t.date ASC, t.original_row_index ASC
      `, [body.workspaceId, user.id]);

      const transactions = txRows.map((r: any) => ({
        id: r.id,
        workspaceId: r.workspace_id,
        bankAccountId: r.bank_account_id,
        statementId: r.statement_id,
        date: r.date,
        description: r.description,
        amount: r.amount,
        balance: r.balance,
        originalRowIndex: r.original_row_index,
        createdAt: r.created_at,
      }));
      const classifications = txRows.map((r: any) => ({
        id: r.id,
        transactionId: r.id,
        finalCategory: r.final_category,
        reportType: r.report_type,
        confidence: r.confidence,
        ruleUsed: r.rule_used,
        reviewStatus: r.review_status,
        isManualCorrection: false,
        createdAt: r.created_at,
        updatedAt: r.created_at,
      }));
      const accounts = await query(
        "SELECT * FROM bank_accounts WHERE company_id = (SELECT company_id FROM workspaces WHERE id = $1) AND user_id = $2",
        [body.workspaceId, user.id]
      );
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
      const flaggedTransactions = transactions.filter((_: any, i: number) => {
        const s = classifications[i]?.reviewStatus;
        return (s && !["approved", "excluded"].includes(s)) || classifications[i]?.confidence === "low";
      });
      const accountReconData = await query(`
        SELECT a.id, a.account_name, a.opening_balance, a.closing_balance,
               COALESCE(SUM(t.amount), 0) as movement_total
        FROM bank_accounts a
        LEFT JOIN transactions t ON t.bank_account_id = a.id AND t.workspace_id = $1 AND t.user_id = $2
        WHERE a.company_id = (SELECT company_id FROM workspaces WHERE id = $3) AND a.user_id = $4
        GROUP BY a.id
      `, [body.workspaceId, user.id, body.workspaceId, user.id]);

      buffer = await buildWorkbookBuffer({
        companyName, taxYear, transactions, classifications, reports,
        flaggedTransactions, accountReconData,
        includeTransactions: body.includeTransactions ?? false,
      });
      const suffix = body.includeTransactions ? "_with_transactions" : "";
      attachmentFilename = `${companyName.replace(/\s+/g, "_")}_${taxYear}_Financial_Statements${suffix}.xlsx`;
    } else {
      if (!body.pkg || !body.transactions) {
        return NextResponse.json({ error: "pkg and transactions required for memo" }, { status: 400 });
      }
      companyName = body.pkg.llcName;
      taxYear = body.pkg.taxYear;
      const model = buildMemoModel(body.pkg, body.transactions);
      buffer = await buildCpaMemoBuffer(model);
      attachmentFilename = `${companyName.replace(/\s+/g, "_")}_${taxYear}_CPA_Memo.docx`;
    }

    const resend = getResend();
    const from = process.env.RESEND_FROM_EMAIL ?? "Valoris <noreply@valoris.cpa>";

    const { error } = await resend.emails.send({
      from,
      to: [body.recipientEmail],
      subject: `Financial Report — ${companyName} (${taxYear})`,
      html: `<p>Please find attached the financial report for <strong>${companyName}</strong> for tax year ${taxYear}.</p>`,
      attachments: [{
        filename: attachmentFilename,
        content: Buffer.from(buffer).toString("base64"),
      }],
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm run lint`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add .env.example src/app/api/emails/report/route.ts
git commit -m "feat: add report email endpoint"
```
