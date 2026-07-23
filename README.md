# AI Financials for CPA Web

Annual financial workflow MVP for CPAs. Processes XLSX bank statements, auto-classifies transactions, supports review/reconciliation, exports P&L, Balance Sheet, Cash Rollforward, and CPA Memo — with email delivery via Resend.

## Prerequisites

- Node.js 24.x
- pnpm (see `packageManager` in package.json)
- A Postgres database (Supabase, Neon, or local)
- A [Resend](https://resend.com) account for transactional emails

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

# Required for E2E tests (must be a separate test database)
DATABASE_URL_TEST=

# Required for email features — Resend API key
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=Valoris <noreply@your-domain.com>
```

## Access Protection

The app uses Supabase Auth for every page and API route. All unauthenticated requests return `401` or redirect to `/login`.

Recommended Supabase Auth setup:

- disable public signups
- create approved users in the Supabase Auth dashboard
- use email/password sign-in for this app
- configure Custom SMTP with Resend for reliable email delivery

Run these SQL scripts in the Supabase SQL editor after initial setup:

1. [`supabase/security/2026-07-15-lockdown.sql`](supabase/security/2026-07-15-lockdown.sql) — revoke anon access, enable RLS on all tables, create storage bucket
2. [`supabase/migrations/2026-07-16-auth-rls-hardening.sql`](supabase/migrations/2026-07-16-auth-rls-hardening.sql) — add per-user RLS policies, add user_id columns, auto-create profiles on signup

## Features

- **Multi-step wizard**: Company setup → bank accounts → upload/import → preclassification review → classification review → reconciliation
- **Deterministic classification**: Rule-based (regex) — no AI costs, no data sent externally
- **Transfer matching**: Auto-detect internal transfers between accounts, exclude from P&L
- **Suspense tracking**: Transactions needing review block "complete" report mode
- **Cash rollforward**: Opening cash + inflows - outflows = calculated ending; variance shown as-is
- **3 report modes**: `classified_bank_activity` → `preliminary_balance_sheet` → `complete_balance_sheet`
- **Opening balances**: Manual input with A - L = E validation
- **25 canonical categories**: Taxonomy centralized in `categoryOptions.ts`
- **CPA Memo**: Generate .docx memo documents with document checklist
- **Email delivery**: Send financial reports as XLSX attachments or CPA Memos as .docx via Resend
- **Welcome email**: Automated welcome email on first sign-in confirmation

## Quick Start

1. Open `http://localhost:3000`.
2. Create a company and select fiscal year.
3. Add bank account(s) with opening/closing balances.
4. Upload `.xlsx` statement (first sheet only).
5. Review preclassification, approve or adjust categories.
6. Check reconciliation status and suspense items.
7. Export Financial Statements or CPA Memo, optionally emailed to recipients.

## Architecture

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS
- **Backend**: Next.js API routes, Postgres via `pg` (Supabase compatible)
- **Import**: `xlsx` (SheetJS), first-sheet-only, deterministic classification with preclassification review
- **Export**: ExcelJS — P&L, Balance Sheet, Cash Rollforward, Transaction History (12 audit columns); docx — CPA Memo
- **Email**: Resend SDK — welcome emails, report delivery with attachments
- **Auth**: Supabase Auth with Custom SMTP (Resend), per-user RLS policies
- **Testing**: Vitest (unit), Playwright (E2E)

## MVP Boundaries

- First worksheet only per XLSX file — subsequent sheets are ignored with a warning.
- Strict fiscal year — only transactions within the selected year are accepted.
- No external AI inference — classification is rule-based.
- Balance Sheet is explicitly preliminary — based on classified bank activity, not full accounting records.
- No automatic journal entries, tax basis calculations, or QuickBooks integration.
- `classification_rules` table exists but is reserved for a future phase — no automatic learning.
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
