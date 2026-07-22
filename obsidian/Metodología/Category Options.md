---
tags:
  - metodologia
  - category-options
---
# Category Options

## Archivo

`src/domain/categoryOptions.ts`

## Propósito

Taxonomía canónica de categorías de clasificación. Single source of truth para frontend (ReviewStep category selector) y backend (classification rules, API).

## Las 25 Categorías

### P&L (Income Statement)

| Categoría | Report Type |
|-----------|-------------|
| Rental Income | P&L |
| Other Income | P&L |
| Interest Income | P&L |
| Rent Expense | P&L |
| Repairs & Maintenance | P&L |
| Utilities | P&L |
| Insurance | P&L |
| Property Taxes | P&L |
| Legal & Accounting | P&L |
| Management Fees | P&L |
| Bank Fees | P&L |
| Interest Expense | P&L |
| Other Expense | P&L |
| Advertising & Marketing | P&L |
| Office Expense | P&L |
| Travel & Meals | P&L |
| Payroll Expenses | P&L |
| Cost of Goods Sold | P&L |
| K-1 / Tax Items | P&L |

### Balance Sheet

| Categoría | Report Type |
|-----------|-------------|
| Opening Balance Equity | Balance Sheet |
| Transfer Clearing | Balance Sheet |
| Wire Transfers | Balance Sheet |
| Credit Card Payable | Balance Sheet |
| Capital Contributions | Balance Sheet |
| Owner Distributions | Balance Sheet |
| Due To / Due From Related Parties | Balance Sheet |
| Loan Liability | Balance Sheet |
| Capital Improvements | Balance Sheet |
| Uncategorized / Needs Review | — |

## Helpers

| Función | Propósito |
|---------|-----------|
| `getCategoriesByReport(reportType)` | Filtra categorías por 'P&L' o 'Balance Sheet' |
| `isValidCategory(value)` | Verifica si un string es una categoría válida |

## Uso

- **ReviewStep.tsx**: `<select>` con optgroups P&L / Balance Sheet
- **classifications/route.ts**: Lookup de reportType por categoría
- **Tests**: Verifican consistencia (sin duplicados, categorías esperadas)

## 🔗 Enlaces Relacionados

- [[Clasificación de Transacciones]]
- [[Financial Reporting]]
- [[Componentes UI]] — ReviewStep
- [[Decisiones Técnicas]] — Single source of truth
