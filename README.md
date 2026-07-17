# AI Financials for CPA Web

Annual financial workflow MVP for CPAs. Processes XLSX bank statements, auto-classifies transactions, supports review/reconciliation, and exports preliminary P&L and Balance Sheet reports.

## Prerequisites

- Node.js 24.x
- pnpm (see `packageManager` in package.json)
- A Postgres database (Supabase, Neon, or local)

```bash
# Use the correct Node version
nvm use           # reads .nvmrc

# Copy and configure environment
cp .env.example .env.local
# Set DATABASE_URL to your Postgres connection string

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

## Access protection

The app now uses Supabase Auth for every page and API route.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Set both variables in `.env.local` before starting the app. Users will see `/login`, and every unauthenticated API request returns `401`.

Recommended Supabase Auth setup:

- disable public signups
- create approved users in the Supabase Auth dashboard
- use email/password sign-in for this app

If you deploy on Supabase, also run [supabase/security/2026-07-15-lockdown.sql](/Users/miguel-mac/Documents/valoris/AI Financials for CPA Web/supabase/security/2026-07-15-lockdown.sql) in the SQL editor to:

- revoke `anon` access to application tables
- allow only `authenticated` users through RLS policies
- create a private storage bucket for financial documents

## Quick start

1. Open `http://localhost:3000`.
2. Create a company and select fiscal year.
3. Add bank account(s) with opening/closing balances.
4. Upload `.xlsx` statement (first sheet only — additional sheets are ignored).
5. Review exceptions, approve or recategorize.
6. Check reconciliation status.
7. Export Financial Statements (optional: with Transaction History).

## Architecture

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS
- **Backend**: Next.js API routes, Postgres via `pg` (Supabase compatible)
- **Import**: `xlsx` (SheetJS), first-sheet-only, deterministic classification
- **Export**: ExcelJS — P&L, Preliminary Balance Sheet from Bank Activity, optional Transaction History
- **Testing**: Vitest (unit), Playwright (E2E)

## MVP boundaries

- First worksheet only per XLSX file — subsequent sheets are ignored with a warning.
- Strict fiscal year — only transactions within the selected year are accepted.
- No external AI inference — classification is rule-based.
- Balance Sheet is explicitly preliminary — based on classified bank activity, not full accounting records.
- No automatic journal entries, tax basis calculations, or QuickBooks integration.
- Supabase Auth protects access, but the current RLS policy is still workspace-wide for all authenticated users rather than per-user row ownership.
- `classification_rules` table exists but is reserved for a future phase — no automatic learning.
