---
tags:
  - referencia
  - workbook
---
# Workbook Export

## Archivo

`src/exports/workbook.ts` — Generación de XLSX con ExcelJS

## Sheets del Workbook

| Sheet | Siempre presente? | Contenido |
|-------|-------------------|-----------|
| Report Status | ✅ | Métricas: transactions, classified, pending, documentation, reconciliation, equation check, mode, mode reasons, matched transfers |
| Profit & Loss | ✅ | Income lines, expense lines, net income, disclaimer PRELIMINARY |
| Balance Sheet | ❌ (solo en modo con BS) | Assets, liabilities, equity, balance check, disclaimer |
| Cash Rollforward | ✅ | Opening cash, inflows, outflows, calculated ending, actual cash, variance |
| Reconciliation | ✅ | Por cuenta: opening, movement, expected close, closing, variance, status |
| Transaction History | Opcional | 12 columnas de auditoría |

## Transaction History — 12 Columnas

| # | Columna | Fuente |
|---|---------|--------|
| 1 | Date | transaction.date |
| 2 | Description | transaction.description |
| 3 | Amount | transaction.amount |
| 4 | Balance | transaction.balance |
| 5 | Bank Account | account name del bank_account |
| 6 | Category | classification.final_category |
| 7 | Report Type | classification.report_type |
| 8 | Confidence | classification.confidence |
| 9 | Rule Used | classification.rule_used |
| 10 | Classification Status | `getClassificationStatus()` |
| 11 | Documentation Status | `getDocumentationStatus()` |
| 12 | Manual Correction | "Yes" si is_manual_correction |
| 13 | Review Notes | Mapa de notas por status |

## Modos de Export

| Botón | Sheets incluidas |
|-------|------------------|
| "Export Financial Statements" | Report Status, P&L, BS (si aplica), Cash Rollforward, Reconciliation |
| "Export Financial Statements + Transactions" | Todo lo anterior + Transaction History |

## Formato

- Archivo: `.xlsx`
- Autofilter en Tx History hasta columna 12
- Disclaimers en P&L y BS
- Modo `classified_bank_activity`: no incluye Balance Sheet sheet

## 🔗 Enlaces Relacionados

- [[Financial Reporting]]
- [[Cash Rollforward]]
- [[Review Policy]] — Classification/Documentation status
- [[Componentes UI]] — ResultsStep
- [[API Endpoints]] — /api/export/workbook
