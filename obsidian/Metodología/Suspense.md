---
tags:
  - metodologia
  - suspense
---
# Suspense

## Archivo

`src/domain/suspense.ts`

## Propósito

Identificar transacciones que están "en suspenso" — no aprobadas, no excluidas, o con categoría "Uncategorized" — que bloquean el modo de reporte `complete_balance_sheet`.

## Función Principal

`buildSuspenseList(classifications, transactions)` → `SuspenseItem[]`

### Criterios de Suspenso

Una transacción está en suspenso si:
1. **`reviewStatus` no es "approved" ni "excluded"** — Pendiente de revisión
2. **`finalCategory` contiene "Uncategorized"** — Sin clasificación válida
3. **`reviewStatus` está en `REVIEW_REQUIRED_STATUS`** — Estados que requieren acción del CPA

### SuspenseItem

| Campo | Tipo | Propósito |
|-------|------|-----------|
| transactionId | string | ID de la transacción |
| date | string | Fecha |
| description | string | Descripción |
| amount | number | Monto |
| currentCategory | string | Categoría actual |
| reviewStatus | string | Estado de revisión |
| reason | string | Por qué está en suspenso ("Uncategorized: {cat}" o "Status: {status}") |

## Impacto en Reportes

- Los items en suspenso **NO se excluyen** del P&L/BS — el review policy del reporting.ts solo filtra `excluded` y `Uncategorized`
- Pero su presencia **bloquea** el modo `complete_balance_sheet`
- Se muestran como alerta en ResultsStep

## 🔗 Enlaces Relacionados

- [[Financial Reporting]]
- [[Review Policy]]
- [[Flujo de Trabajo]] — Step 6
- [[Decisiones Técnicas]] — Suspense como gatekeeper
