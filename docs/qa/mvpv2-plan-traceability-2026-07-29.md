# MVP V2 CPA Workflow QA Traceability

Date: 2026-07-29
Branch: `MvpV2`
Commit verified: `efe144f`

## Verification Commands

- `pnpm build`: pass. Next.js build compiled, type checked, and generated 21 static pages.
- `pnpm lint`: pass. `tsc --noEmit` completed with exit code 0.
- `pnpm test`: pass. 26 test files passed, 1 skipped; 186 tests passed, 5 skipped.
- `pnpm test:e2e`: not run because `DATABASE_URL_TEST` is not configured. This matches the implementation plan condition.

Note: commands emitted the existing Node engine warning because the repo wants Node `24.x` and the local runtime is Node `v26.5.0`.

## Executive Result

The product substantially implements the MVP V2 plan, especially import handling, accounting classification safeguards, review statuses, company classification rule suggestion behavior, reconciliation visibility, results shortcuts, and CPA exports.

The main QA gap is not implementation coverage but automated coverage: several UI and API behaviors exist in code but do not yet have dedicated tests matching the plan's requested component/API matrix.

## Requirement Traceability

### 1. Multi-format import and QA

Status: Cumple.

Evidence:
- Unified importer supports CSV, XLSX, and text-based PDF in `src/domain/statementImport.ts`.
- Unsupported/scanned PDF error path is tested in `tests/domain/statementImport.test.ts`.
- CSV quoted commas, accounting parentheses, debit/credit, semicolon delimiter, XLSX, and PDF text extraction are tested in `tests/domain/statementImport.test.ts`.
- XLSX multi-sheet behavior is covered in `tests/domain/importXlsx.test.ts` and API-level import flow tests.

Remaining gap:
- Real anonymized fixtures from Diomar/Merzo are still pending because those files have not been provided.

### 2. Classification and human review

Status: Cumple for domain behavior; partial for API automation tests.

Evidence:
- `SOFTWARE/SUBSCRIPTION` remains `Other Expense`, `medium`, `support_needed` in `src/domain/classification.ts` and is covered by `tests/domain/classification.test.ts`.
- Wire transfers, related-party/intercompany/Valoris patterns, credit card payments, and partner/member transfers are forced into review statuses in `src/domain/classification.ts`.
- Company rules are suggestions only: `medium`, `pending`, `ruleUsed = "Company rule — ..."` in `src/domain/classificationRules.ts`.
- Recurring rule behavior is tested in `tests/domain/classificationRules.test.ts`.

Remaining gap:
- No dedicated route test currently exercises `POST /api/classification-rules` or DB persistence.

### 3. ReviewStep as control center

Status: Implemented; partially tested.

Evidence:
- Tabs implemented: Exceptions, All Transactions, Related Parties, Credit Cards, Low Confidence, Unreconciled Account in `src/components/wizard/ReviewStep.tsx`.
- Filters implemented: account, status, category, statement, amount range, search.
- Actions implemented: approve, exclude, CPA review, support needed, category edits, save rule, correction.
- Notes are passed to `/api/classifications` and saved into `review_events`.

Remaining gap:
- Component tests do not yet validate tab filtering, bulk actions, note persistence from UI, or rule creation from the ReviewStep.

### 4. Reconciliation and correction from summary

Status: Mostly cumple; one product gap remains.

Evidence:
- Reconciliation table shows opening, movement, expected close, actual closing, variance, transaction count, statement count, possible causes, and action in `src/components/wizard/ReconciliationStep.tsx`.
- "Review transactions" navigates to Review with account filtering through `src/components/wizard/Wizard.tsx`.
- Review includes Account Activity totals and last running balance when account filter is active.
- `correct_transaction` updates date/description/amount through an explicit audited action in `src/app/api/classifications/route.ts`; raw import rows remain preserved by transaction update rather than statement replacement.

Remaining gap:
- "Outside fiscal year" and "running balance mismatch" are not explicitly detected as possible causes; current causes include missing statement, running balance unavailable, duplicate suspected, and generic variance review.

### 5. Results and CPA-ready export

Status: Cumple for implemented export surfaces; partial for exact workbook sheet matrix.

Evidence:
- Results shortcuts exist for unresolved classifications, related-party review, credit card statements, and unreconciled accounts in `src/components/wizard/ResultsStep.tsx`.
- Workbook includes Statement Files and Review Log sheets when data is present in `src/exports/workbook.ts`.
- Workbook export route fetches review events in `src/app/api/export/workbook/route.ts`.
- CPA memo includes import formats, pending/open items, related-party items, reconciliation variances, and PDF text-only limitation in `src/exports/cpaMemo.ts`.
- Workbook and CPA memo additions are tested in `tests/exports/workbook.test.ts` and `tests/exports/cpaMemo.test.ts`.

Remaining gap:
- The plan listed exact sheet names: Import Summary, Reconciliation Summary, Suspense / CPA Review Items, Transaction History, P&L, Balance Sheet, Cash Rollforward. Some equivalent data exists under current sheets/reports, but not every requested sheet name is verified by a dedicated test.

### 6. APIs, types, and data model

Status: Implemented; partial automated coverage.

Evidence:
- `POST /api/classifications` accepts `note`, `reviewStatus`, and actions `mark_support_needed`, `mark_cpa_review`, `change_category`, `correct_transaction`.
- `POST /api/classification-rules` and `GET /api/classification-rules?companyId=...` exist.
- `review_events` stores previous/new category, previous/new status, note, correction JSON, and user ID.
- Types added in `src/domain/types.ts`: `ReviewAction`, `ReviewNote`, `CompanyClassificationRule`, `TransactionCorrection`, `ReconciliationIssue`.
- Supabase migration and local migration exist for review audit and company rules.

Remaining gap:
- API route tests for classifications and classification rules are not present yet.

## Test Plan Coverage Matrix

| Test area from plan | Current QA result |
| --- | --- |
| Domain: recurring rules suggest future categories | Covered by `tests/domain/classificationRules.test.ts` |
| Domain: recurring rules do not auto-approve | Covered by `tests/domain/classificationRules.test.ts` |
| Domain: software/subscription remains medium/support_needed | Covered by `tests/domain/classification.test.ts` |
| Domain: fuel and telecom merchant signals | Covered by `tests/domain/statementImport.test.ts` |
| Domain: related parties, wires, credit cards, distributions in review | Covered mostly by `tests/domain/classification.test.ts`; related-party exact status should get a direct assertion |
| Import: Chase-like field mismatch | Covered by CSV parser behavior and import flow tests |
| Import: quoted commas/accounting parentheses | Covered by `tests/domain/statementImport.test.ts` |
| Import: debit/credit | Covered by `tests/domain/statementImport.test.ts` and `tests/api/import-flow.test.ts` |
| Import: XLSX multi-sheet | Covered by `tests/domain/importXlsx.test.ts` and `tests/api/import-flow.test.ts` |
| Import: text-based PDF | Covered by `tests/domain/statementImport.test.ts` |
| Import: scanned PDF rejected | Covered by `tests/domain/statementImport.test.ts` |
| API: classification action with note creates review event | Implementation present; missing dedicated route test |
| API: change category updates report type | Implementation present; missing dedicated route test |
| API: create classification rule from correction | Implementation present in UI/API; missing route/component test |
| API: applying rule leaves status reviewable | Covered at domain/preclassification level |
| Component: Review tabs filter correctly | Implementation present; missing component test |
| Component: bulk actions selected rows only | Implementation present; missing component test |
| Component: reconciliation review opens filtered Review | Implementation present; missing component test |
| Component: Results deep-links filter correctly | Implementation present; missing component test |
| Export: workbook includes required new sheets | Partially covered; Review Log and Statement Files tested |
| Export: unresolved items appear in memo | Existing memo open items tested; richer export-route population not route-tested |
| Full checks | `pnpm build`, `pnpm lint`, `pnpm test` passed; e2e skipped due missing `DATABASE_URL_TEST` |

## Recommended QA Follow-ups

1. Add API route tests for `/api/classifications` using an isolated test database or mocked `query/withTransaction`.
2. Add API route tests for `/api/classification-rules` covering create/list, invalid category, and company ownership.
3. Add React component tests for `ReviewStep`, `ReconciliationStep`, `Wizard`, and `ResultsStep` navigation/filter presets.
4. Add explicit workbook tests for the exact sheet list expected by the CPA plan.
5. Add explicit reconciliation cause tests for out-of-fiscal-year and running-balance mismatch once those two heuristics are implemented.
6. Run Playwright e2e once `DATABASE_URL_TEST` is configured.
