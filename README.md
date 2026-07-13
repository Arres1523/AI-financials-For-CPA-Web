# AI Financials for CPA Web

Annual financial workflow MVP for CPAs. Processes XLSX bank statements, auto-classifies transactions, supports review/reconciliation, and exports preliminary P&L and Balance Sheet reports.

## Prerequisites

- Node.js >=26.5.0 <27
- pnpm (see `packageManager` in package.json)

```bash
# Use the correct Node version
nvm use           # reads .nvmrc
# or install manually with the version in .nvmrc

# Clean install
pnpm install

# Rebuild native dependencies (needed after Node version change)
pnpm rebuild better-sqlite3
```

## Development

```bash
pnpm dev          # starts on http://localhost:3000
pnpm lint         # TypeScript type check
pnpm test         # unit + integration tests
pnpm test:e2e     # Playwright E2E tests
pnpm build        # production build
```

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
- **Backend**: Next.js API routes, SQLite via `better-sqlite3`
- **Import**: `xlsx` (SheetJS), first-sheet-only, deterministic classification
- **Export**: ExcelJS — P&L, Preliminary Balance Sheet from Bank Activity, optional Transaction History
- **Testing**: Vitest (unit), Playwright (E2E)

## MVP boundaries

- First worksheet only per XLSX file — subsequent sheets are ignored with a warning.
- Strict fiscal year — only transactions within the selected year are accepted.
- No external AI inference — classification is rule-based.
- Balance Sheet is explicitly preliminary — based on classified bank activity, not full accounting records.
- No automatic journal entries, tax basis calculations, or QuickBooks integration.
- No authentication, multi-user, or cloud persistence.
- `classification_rules` table exists but is reserved for a future phase — no automatic learning.
