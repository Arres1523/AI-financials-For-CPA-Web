# AI Financials for CPA Web

Annual CPA package workflow for Valoris LLCs. The MVP creates a CPA package workspace, tracks the SOP document checklist, imports bank CSV activity, applies conservative classification rules, checks reconciliation, and exports the CPA workbook plus memo.

## Local run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## CPA package smoke scenario

1. Keep `Valoris Demo LLC` and `2025`.
2. Review the SOP document checklist.
3. Paste a CSV with rent income, bank fee, owner contribution, AMEX payment, and related-party transfer.
4. Import transactions.
5. Confirm owner contribution and AMEX payment are Balance Sheet items.
6. Confirm P&L excludes contributions, transfers, investments, and credit-card payments.
7. Confirm package blockers list missing memo support or reviewer approval.
8. Export workbook and confirm exactly three visible tabs: `Transaction Detail`, `P&L 2025`, and `Balance Sheet`.
9. Export CPA memo and confirm missing documents and open review items appear.

## Current MVP boundaries

- No external AI inference.
- No partner tax basis, tax capital, at-risk basis, or final K-1 allocation calculations.
- PDF extraction, Supabase persistence, Google Drive automation, WebLLM, and CPA collaboration are later phases.
