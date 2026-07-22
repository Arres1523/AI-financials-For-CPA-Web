---
tags:
  - metodologia
  - opening-balances
---
# Opening Balances

## Archivos

- `src/domain/openingBalances.ts` — Validación
- `src/lib/migrations/004_opening_balance_entries.sql` — Tabla BD
- `src/app/api/opening-balances/route.ts` — API endpoint

## Propósito

Permitir que el CPA provea saldos de apertura (activos, pasivos, patrimonio) para habilitar modos de reporte más completos.

## Tabla BD: opening_balance_entries

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | TEXT PK | UUID |
| workspace_id | TEXT FK | Workspace al que pertenecen |
| account_name | TEXT | Nombre (ej. "Cash", "Accounts Payable") |
| account_type | TEXT | 'asset', 'liability', o 'equity' |
| amount | REAL | Saldo |
| source | TEXT | 'manual' (default) |
| support_status | TEXT | 'provided', 'missing', 'reviewed' |
| created_at | TEXT | Timestamp |

## Validación

`validateOpeningBalanceSheet(entries)` → `OpeningBalanceSheetInput`

```
Assets - Liabilities - Equity ≈ 0  (tolerance: 1¢)
```

Retorna `isValid: boolean` y `difference: number`.

## API

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| GET | `/api/opening-balances?workspaceId=X` | Obtener entries |
| POST | `/api/opening-balances` | Guardar/actualizar entries |

## Impacto en Reportes

- Si no hay opening balances → modo `classified_bank_activity`
- Si hay opening balances (válidos o no) → modo `preliminary_balance_sheet`
- Si hay opening balances + todas las demás condiciones → modo `complete_balance_sheet`

## 🔗 Enlaces Relacionados

- [[Financial Reporting]] — Modos de reporte
- [[Cash Rollforward]] — openingCash
- [[Esquema de BD]] — Tabla opening_balance_entries
- [[API Endpoints]] — /api/opening-balances
- [[Componentes UI]] — ReconciliationStep
