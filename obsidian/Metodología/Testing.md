---
tags:
  - metodologia
  - testing
---
# Testing

## Estrategia

```
Tests Unitarios (Vitest + jsdom)
  ├── Domain Layer (pure functions → fáciles de testear)
  │   ├── classification.test.ts        → casos actualizados
  │   ├── categoryOptions.test.ts       → 5 casos (consistencia taxonomía)
  │   ├── reviewPolicy.test.ts          → casos específicos
  │   ├── reconciliation.test.ts        → 2 casos
  │   ├── reporting.test.ts             → casos expandidos (modos, controles)
  │   ├── transferMatching.test.ts      → 65+ casos (matching entre cuentas)
  │   ├── suspense.test.ts              → 58+ casos (detección suspenso)
  │   ├── cashRollforward.test.ts       → 84+ casos (rollforward puro)
  │   ├── openingBalances.test.ts       → 32+ casos (validación A-L=E)
  │   ├── importXlsx.test.ts            → 8 casos (+ fixtures)
  │   ├── importCsv.test.ts             → 1 caso
  │   ├── chartOfAccounts.test.ts       → 2 casos
  │   └── cpaPackage.test.ts            → 1 caso
  │
  ├── Export Layer
  │   ├── workbook.test.ts              → casos expandidos (12 cols, rollforward, modos)
  │   └── cpaMemo.test.ts               → 1 caso
  │
  ├── API Integration
  │   ├── import-flow.test.ts           → 10+ casos (condicional)
  │   └── qa-real-data-report.test.ts   → QA con datos reales
  │
  └── UI Smoke
      └── app-page.test.tsx             → 1 caso

Tests E2E (Playwright)
  └── main.spec.ts                      → 6 escenarios completos
```

## Cobertura

### Tests Unitarios (Vitest)

| Archivo | Casos | Qué prueba |
|---------|-------|------------|
| `classification.test.ts` | ~7 | Owner contributions off P&L, CC payments, K-1 flagged, rental income, bank fees, interest, utilities, capital improvements |
| `categoryOptions.test.ts` | 5 | Consistencia de taxonomy: categorías únicas, report types válidos, sin duplicados, CATEGORY_OPTIONS vs classification.ts |
| `reviewPolicy.test.ts` | ~5 | Estados de revisión, documentación requerida, transiciones válidas |
| `importXlsx.test.ts` | 8 | Chase format, AMEX debit/credit, multi-sheet warning, empty file error, valid import, debit/credit import, outside fiscal year, multi-sheet import |
| `reconciliation.test.ts` | 2 | Reconciled (opening+movement=closing), Unreconciled |
| `reporting.test.ts` | ~12 | buildReports, buildBankReconciliation, buildClassificationCompleteness, buildAccountingEquation, determineFinancialReportMode, buildFinancialReport (modos, suspense, equation check, matched transfers exclusion) |
| `transferMatching.test.ts` | ~10 | Matching por regex, rango de fecha, ±1¢, cuentas diferentes, unmatched quedan fuera |
| `suspense.test.ts` | ~6 | Items no aprobados, Uncategorized, REVIEW_REQUIRED_STATUS, razones de suspenso |
| `cashRollforward.test.ts` | ~8 | openingCash, inflows, outflows, calculatedEnding, variance, múltiples cuentas |
| `openingBalances.test.ts` | ~5 | A=L+E balanced, unbalanced, diferencia, un solo lado |
| `workbook.test.ts` | ~6 | Correct sheets sin/ con Tx History, 12 columnas, cash rollforward sheet, reconciliation sheet, modo classified_bank_activity sin BS |
| `cpaMemo.test.ts` | 1 | Missing documents + open review items |
| `chartOfAccounts.test.ts` | 2 | 8 checklist folders, no slash-combined names |
| `importCsv.test.ts` | 1 | CSV normalization |
| `cpaPackage.test.ts` | 1 | Missing documents block completion |
| `import-flow.test.ts` | 10 | Full import-flow domain logic (needs running server) |
| `qa-real-data-report.test.ts` | ~8 | QA con datos reales: validación de clasificación, categorías, reglas Wyndham, P&L, BS |

### Tests E2E (Playwright)

| Escenario | Qué cubre |
|-----------|-----------|
| Full workflow | Crear compañía, agregar cuenta, upload, import, approve, reconcile, export |
| Empty file error | Upload empty_sample.xlsx → mensaje de error |
| Debit/credit columns | Upload amex_sample.xlsx → import exitoso |
| Duplicate file | Upload mismo archivo 2 veces → "was already imported" |
| Recover after reload | Recargar página, buscar compañía, verificar persistencia |

## Fixtures (XLSX)

| Archivo | Filas | Columnas | Propósito |
|---------|-------|----------|-----------|
| `chase_sample.xlsx` | 8 | Date/Description/Amount/Balance | Flujo estándar |
| `amex_sample.xlsx` | 3 | Date/Description/Debit/Credit | Formato alternativo |
| `multisheet_sample.xlsx` | 2 hojas | Date/Description/Withdrawal/Deposit | Multi-sheet |
| `empty_sample.xlsx` | 0 | - | Archivo vacío |

## Cómo Ejecutar

```bash
pnpm test          # Unit + integration (Vitest)
pnpm test:e2e      # E2E (Playwright) — requiere servidor
pnpm test:e2e:ui   # E2E con UI Playwright
pnpm lint          # TypeScript type check
pnpm test:qa       # QA real-data report (si existe script)
```

## 🔗 Enlaces Relacionados

- [[Deuda Técnica]] — Tests faltantes
- [[Errores Conocidos]] — Bugs detectados por tests
