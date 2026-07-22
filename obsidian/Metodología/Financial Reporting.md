---
tags:
  - metodologia
  - reporting
---
# Financial Reporting

## Archivo Principal

`src/domain/reporting.ts` — Orquestador central de reportes financieros.

## Modos de Reporte

El sistema tiene 3 modos determinados automáticamente por `determineFinancialReportMode()`:

| Modo | Condiciones | Qué incluye |
|------|-------------|-------------|
| `classified_bank_activity` | Sin opening balances, o hay suspenso, o faltan card statements | Solo P&L + BS parcial (actividad bancaria clasificada) |
| `preliminary_balance_sheet` | Opening balances existen, o hay suspenso, o card statements needed | P&L + BS con apertura pero con advertencias |
| `complete_balance_sheet` | Opening balances OK + sin suspenso + sin card statements + todo reconciliado + ecuación OK + clasif completa | Reporte completo sin advertencias |

### Escalabilidad de Modos

```
classified_bank_activity
    → (agregar opening balances) → preliminary_balance_sheet
    → (resolver suspenso + card statements + reconciliar + clasificar) → complete_balance_sheet
```

## Controles (Checks)

### 1. Bank Reconciliation (`buildBankReconciliation`)
- Por cada cuenta: opening + movement - closing = variance
- Output: `BankReconciliationCheck[]`

### 2. Classification Completeness (`buildClassificationCompleteness`)
- Total / Approved / Excluded / Unresolved
- Classified count, documentationComplete, documentationPending
- Output: `ClassificationCompletenessCheck`
- Depende de `classificationStatus.ts` helpers

### 3. Accounting Equation (`buildAccountingEquation`)
- A = L + E check
- Detecta `missingInputs`: openingBS, suspense, cardStatementsNeeded
- Output: `passed` / `failed` / `incomplete_data`

## buildFinancialReport (Orquestador)

```typescript
function buildFinancialReport(accounts, transactions, classifications, reviewPolicy): FinancialReport
```

Orden de operaciones:
1. `matchInternalTransfers()` — identificar transfers entre cuentas
2. Excluir IDs de transfers matcheados de P&L/BS
3. `buildReports()` — P&L y Balance Sheet (sin transfers)
4. `buildBankReconciliation()` — checks por cuenta
5. `buildClassificationCompleteness()` — stats de clasificación
6. `buildAccountingEquation()` — A = L + E
7. `determineFinancialReportMode()` — modo basado en checks
8. `buildSuspenseList()` — items en suspenso
9. `buildCashRollforward()` — rollforward puro
10. Retornar `FinancialReport` completo

## FinancialReport Type

| Campo | Tipo | Propósito |
|-------|------|-----------|
| mode | FinancialReportMode | Modo actual del reporte |
| modeReasons | string[] | Razones del modo actual |
| pnl | PnLReport | Income / Expenses / Net Income |
| balanceSheet | BalanceSheetReport | Assets / Liabilities / Equity |
| bankReconciliation | BankReconciliationCheck[] | Checks por cuenta |
| classificationCompleteness | ClassificationCompletenessCheck | Stats clasificación |
| accountingEquation | AccountingEquationCheck | A = L + E |
| suspense | SuspenseItem[] | Items en suspenso |
| openingCash, totalInflows, totalOutflows, actualCash, expectedCash, totalCashVariance | number | Cash rollforward |
| matchedTransferCount, matchedTransferAmount | number | Transfers matcheados |

## 🔗 Enlaces Relacionados

- [[Flujo de Trabajo]]
- [[Transfer Matching]]
- [[Suspense]]
- [[Cash Rollforward]]
- [[Opening Balances]]
- [[Category Options]]
- [[Review Policy]]
- [[Componentes UI]] — ResultsStep
