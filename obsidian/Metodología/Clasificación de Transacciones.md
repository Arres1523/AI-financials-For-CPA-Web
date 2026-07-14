---
tags:
  - metodologia
  - clasificacion
---
# Clasificación de Transacciones

## Motor de Clasificación Determinista

Archivo: `src/domain/classification.ts`

### Orden de Prioridad (First Match Wins)

| # | Regla | Confianza | Report Type |
|---|-------|-----------|-------------|
| 1 | Transfer Clearing (inter-cuenta) | `HIGH` → Approved | Balance Sheet |
| 2 | Credit Card Liability (AMEX, CC payments) | `HIGH` → Approved | Balance Sheet |
| 3 | Owner Contributions | `HIGH` → Approved | Balance Sheet |
| 4 | Owner Distributions | `HIGH` → Approved | Balance Sheet |
| 5 | Related Party (Due To/From) — Valoris, intercompany | `HIGH` → Approved | Balance Sheet |
| 6 | Loan Liability (pagos de principal) | `HIGH` → Approved | Balance Sheet |
| 7 | Rental Income | `MEDIUM` → Pending Review | P&L |
| 8 | Rent Expense | `MEDIUM` → Pending Review | P&L |
| 9 | Other Income | `MEDIUM` → Pending Review | P&L |
| 10 | Capital Improvements | `LOW` → Pending Review | Balance Sheet |
| 11 | Repairs & Maintenance | `MEDIUM` → Pending Review | P&L |
| 12 | Utilities | `MEDIUM` → Pending Review | P&L |
| 13 | Insurance | `MEDIUM` → Pending Review | P&L |
| 14 | Property Taxes | `MEDIUM` → Pending Review | P&L |
| 15 | Legal & Accounting | `MEDIUM` → Pending Review | P&L |
| 16 | Management Fees | `MEDIUM` → Pending Review | P&L |
| 17 | Bank Fees | `MEDIUM` → Pending Review | P&L |
| 18 | Interest Expense | `MEDIUM` → Pending Review | P&L |
| 19 | Other Expense | `LOW` → Pending Review | P&L |
| 20 | K-1 / Tax Items | `LOW` → Pending Review | P&L |
| 21 | Fallback: Transfer Clearing | `LOW` → Pending Review | Balance Sheet |

### Niveles de Confianza

- **HIGH** → `reviewStatus: "approved"` — Clasificación automática sin revisión
- **MEDIUM** → `reviewStatus: "pending"` — Requiere revisión del CPA
- **LOW** → `reviewStatus: "pending"` — Requiere revisión, baja confianza

### Report Types

- **P&L** → Income / Expenses → van al Estado de Resultados
- **Balance Sheet** → Assets / Liabilities / Equity → van al Balance Sheet

### Observaciones Clave ⚠️

- Las reglas 1-6 (Balance Sheet) salen del P&L automáticamente
- Las reglas 10 y 20 tienen baja confianza y SIEMPRE deben revisarse
- La regla 21 (fallback) captura todo lo no clasificado como Transfer Clearing
- Owner Contributions/Distributions y Credit Card payments NO deben aparecer como ingresos/gastos

## 🔗 Enlaces Relacionados

- [[Errores Conocidos]] — Errores de clasificación identificados
- [[Features Pendientes]] — WebLLM, reglas por compañía
- [[API Endpoints]] — `/api/classifications`
