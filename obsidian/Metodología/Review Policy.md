---
tags:
  - metodologia
  - review-policy
---
# Review Policy

## Archivos

- `src/domain/reviewPolicy.ts` — Estados y reglas de revisión
- `src/domain/classificationStatus.ts` — Helpers de estado

## Estados de Revisión

| Estado | Significado | ¿En reportes? |
|--------|-------------|---------------|
| `approved` | Clasificado y aprobado | ✅ Sí |
| `excluded` | Excluido por el CPA | ❌ No |
| `pending` | Pendiente de revisión | ✅ Sí (con advertencia) |
| `support_needed` | Requiere documentos de soporte | ✅ Sí |
| `cpa_review` | Requiere revisión del CPA | ✅ Sí |
| `card_statements_needed` | Requiere estados de tarjeta | ✅ Sí |

## Estados de Documentación

`getDocumentationStatus(classification)`:

| Estado | Cuándo ocurre |
|--------|---------------|
| `card_statements_needed` | reviewStatus = card_statements_needed |
| `support_needed` | reviewStatus = support_needed |
| `cpa_review` | reviewStatus = cpa_review |
| `complete` | Cualquier otro estado |

## Estados de Clasificación

`getClassificationStatus(classification)`:

| Estado | Cuándo ocurre |
|--------|---------------|
| `excluded` | reviewStatus = excluded |
| `needs_classification` | finalCategory contiene "Uncategorized" |
| `classified` | Cualquier otro caso |

## Regla de Filtrado en Reportes

En `buildReportsFromClassifications()`, solo se filtran:
1. `reviewStatus === "excluded"`
2. `finalCategory === "Uncategorized"`

Todos los demás estados (`support_needed`, `cpa_review`, `card_statements_needed`, `pending`) **permanecen** en los reportes. Los items en `cpa_review` / `card_statements_needed` afectan el modo de reporte pero no desaparecen del P&L/BS.

## 🔗 Enlaces Relacionados

- [[Financial Reporting]]
- [[Suspense]]
- [[Clasificación de Transacciones]]
- [[Componentes UI]] — ReviewStep
