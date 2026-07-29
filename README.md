# AI Financials for CPA Web

Annual financial workflow MVP for CPAs. Processes CSV, XLSX, and text-based PDF bank statements, auto-classifies transactions, supports review/reconciliation, exports P&L, Balance Sheet, Cash Rollforward, and CPA Memo — with email delivery via Resend.

## Prerequisites

- Node.js 24.x
- pnpm (see `packageManager` in package.json)
- A Postgres database (Supabase, Neon, or local)
- A Supabase project with Auth enabled
- A [Resend](https://resend.com) account for app transactional emails

```bash
# Use the correct Node version
nvm use           # reads .nvmrc

# Copy and configure environment
cp .env.example .env.local
# Set DATABASE_URL, Supabase keys, and Resend API key

# Install dependencies
pnpm install
```

## Development

```bash
pnpm dev          # starts on http://localhost:3000
pnpm lint         # TypeScript type check
pnpm test         # unit + integration tests
pnpm test:e2e     # Playwright E2E tests
pnpm build        # production build
```

## Environment Variables

```env
# Required — Postgres connection string
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres

# Required — Supabase Auth / browser client
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key

# Required — Supabase server-side Admin Auth for /register
# Never expose this as NEXT_PUBLIC_*
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required for E2E tests (must be a separate test database)
DATABASE_URL_TEST=

# Required for email features — Resend API key
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=Valoris <noreply@your-domain.com>
```

### Supabase Auth Keys

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is used by browser code for normal user sessions.

`SUPABASE_SERVICE_ROLE_KEY` is used only by the server route `/api/auth/register` to create confirmed users with Supabase Admin Auth. Never expose it with a `NEXT_PUBLIC_` prefix and never commit it to git.

## Access Protection

The app uses Supabase Auth for every page and API route. All unauthenticated requests return `401` or redirect to `/login`.

Recommended Supabase Auth setup:

- disable public signups
- keep `SUPABASE_SERVICE_ROLE_KEY` configured in Vercel for Production and Preview
- use email/password sign-in for this app
- configure Custom SMTP with Resend for password resets and other Auth emails

Run these SQL scripts in the Supabase SQL editor after initial setup:

1. [`supabase/security/2026-07-15-lockdown.sql`](supabase/security/2026-07-15-lockdown.sql) — revoke anon access, enable RLS on all tables, create storage bucket
2. [`supabase/migrations/2026-07-16-auth-rls-hardening.sql`](supabase/migrations/2026-07-16-auth-rls-hardening.sql) — add per-user RLS policies, add user_id columns, auto-create profiles on signup

### Registration Flow

`/register` does not call `supabase.auth.signUp()` from the browser. Browser sign-up depends on Supabase confirmation email delivery, so broken SMTP can block account creation with an unhelpful `{}` or generic error.

Instead, the form calls:

```txt
POST /api/auth/register
```

That server route uses `SUPABASE_SERVICE_ROLE_KEY` and `supabase.auth.admin.createUser({ email_confirm: true })`, then the client signs in with `signInWithPassword`.

If registration fails in production:

1. Check Vercel has `SUPABASE_SERVICE_ROLE_KEY` in both Production and Preview.
2. Redeploy after changing env vars.
3. Check Supabase Auth logs for SMTP errors such as `535 "Authentication credentials invalid"`.
4. Check Vercel runtime logs for `/api/auth/register`.

## Features

- **Multi-step wizard**: Company setup → bank accounts → upload/import → preclassification review → classification review → reconciliation
- **Multi-format statement import**: CSV, XLSX, and best-effort text-based PDF parsing with column mapping and review warnings
- **Deterministic classification**: Rule-based (regex) — no AI costs, no data sent externally
- **Company classification rules**: recurring company-scoped suggestions remain reviewable before approval
- **Transfer matching**: Auto-detect internal transfers between accounts, exclude from P&L
- **Suspense tracking**: Transactions needing review block "complete" report mode
- **Cash rollforward**: Opening cash + inflows - outflows = calculated ending; variance shown as-is
- **3 report modes**: `classified_bank_activity` → `preliminary_balance_sheet` → `complete_balance_sheet`
- **Opening balances**: Manual input with A - L = E validation
- **25 canonical categories**: Taxonomy centralized in `categoryOptions.ts`
- **CPA Memo**: Generate .docx memo documents with document checklist
- **Email delivery**: Send financial reports as XLSX attachments or CPA Memos as .docx via Resend
- **Server-side registration**: Create confirmed Supabase users without depending on Auth confirmation email delivery
- **Welcome email**: Automated welcome email endpoint for confirmed-session flows

## Quick Start

1. Open `http://localhost:3000`.
2. Create a company and select fiscal year.
3. Add bank account(s) with opening/closing balances.
4. Upload `.csv`, `.xlsx`, or text-based `.pdf` statements.
5. Review preclassification, approve or adjust categories.
6. Check reconciliation status and suspense items.
7. Export Financial Statements or CPA Memo, optionally emailed to recipients.

## Architecture

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS
- **Backend**: Next.js API routes, Postgres via `pg` (Supabase compatible)
- **Auth**: Supabase Auth; server-side registration via Admin Auth; browser sessions via `@supabase/ssr`
- **Import**: CSV (PapaParse), XLSX (SheetJS), text-based PDF best-effort extraction, deterministic classification with preclassification review
- **Export**: ExcelJS — P&L, Balance Sheet, Cash Rollforward, Transaction History (12 audit columns); docx — CPA Memo
- **Email**: Resend SDK — welcome emails, report delivery with attachments
- **Testing**: Vitest (unit), Playwright (E2E)

## MVP Boundaries

- First worksheet only per XLSX file — subsequent sheets are ignored with a warning.
- PDF import supports text-based PDFs only. Scanned PDFs require conversion to CSV/XLSX or a future OCR workflow.
- Strict fiscal year — only transactions within the selected year are accepted.
- No external AI inference — classification is rule-based.
- Balance Sheet is explicitly preliminary — based on classified bank activity, not full accounting records.
- No automatic journal entries, tax basis calculations, or QuickBooks integration.
- `classification_rules` are company-scoped suggestions, not automatic final approvals.
- Resend free tier (`onboarding@resend.dev`) can only send to the account owner's email. Verify a custom domain for production.

## Documentation

Project documentation is maintained as an [Obsidian vault](obsidian/) for cross-referenced notes:

| Category | Files |
|----------|-------|
| **Methodology** | Architecture, Workflow, Classification, Reporting, Transfer Matching, Suspense, Cash Rollforward, Opening Balances, Category Options, Review Policy, Database, API, Testing |
| **Reference** | Tech Stack, DB Schema, UI Components, Glossary, Workbook Export |
| **Errors & Issues** | Known Bugs, Edge Cases, Technical Debt, Email Integration |
| **Improvements** | Roadmap, Pending Features, Optimizations, MVP Boundaries |
| **Observations** | Technical Decisions, Design Patterns, Project Notes |

External design specs and implementation plans are in [`docs/superpowers/`](docs/superpowers/).
