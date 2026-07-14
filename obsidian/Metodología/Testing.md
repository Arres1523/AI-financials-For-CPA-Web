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
  │   ├── classification.test.ts      → 7 casos
  │   ├── reconciliation.test.ts      → 2 casos
  │   ├── reporting.test.ts           → 2 casos
  │   ├── importXlsx.test.ts          → 8 casos (+ fixtures)
  │   ├── importCsv.test.ts           → 1 caso
  │   ├── chartOfAccounts.test.ts     → 2 casos
  │   └── cpaPackage.test.ts          → 1 caso
  │
  ├── Export Layer
  │   ├── workbook.test.ts            → 2 casos
  │   └── cpaMemo.test.ts             → 1 caso
  │
  ├── API Integration
  │   └── import-flow.test.ts         → 10 casos (condicional)
  │
  └── UI Smoke
      └── app-page.test.tsx           → 1 caso

Tests E2E (Playwright)
  └── main.spec.ts                    → 6 escenarios completos
```

## Cobertura

### Tests Unitarios (Vitest)

| Archivo | Casos | Qué prueba |
|---------|-------|------------|
| `classification.test.ts` | 7 | Owner contributions off P&L, CC payments, K-1 flagged, rental income, bank fees, interest, utilities, capital improvements |
| `importXlsx.test.ts` | 8 | Chase format, AMEX debit/credit, multi-sheet warning, empty file error, valid import, debit/credit import, outside fiscal year, multi-sheet import |
| `reconciliation.test.ts` | 2 | Reconciled (opening+movement=closing), Unreconciled |
| `reporting.test.ts` | 2 | BS activity out of P&L, balance check non-zero |
| `workbook.test.ts` | 2 | Correct sheets without Tx History, includes Tx History |
| `cpaMemo.test.ts` | 1 | Missing documents + open review items |
| `chartOfAccounts.test.ts` | 2 | 8 checklist folders, no slash-combined names |
| `importCsv.test.ts` | 1 | CSV normalization |
| `cpaPackage.test.ts` | 1 | Missing documents block completion |
| `import-flow.test.ts` | 10 | Full import-flow domain logic (needs running server) |

### Tests E2E (Playwright)

| Escenario | Qué cubre |
|-----------|-----------|
| Full workflow | Crear compañía, agregar cuenta, upload, import, approve, reconcile, export |
| Empty file error | Upload empty_sample.xlsx → mensaje de error |
| Debit/credit columns | Upload amex_sample.xlsx → import exitsoso |
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
```

## 🔗 Enlaces Relacionados

- [[Deuda Técnica]] — Tests faltantes
- [[Errores Conocidos]] — Bugs detectados por tests
