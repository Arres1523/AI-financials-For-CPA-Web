---
tags:
  - metodologia
  - api
---
# API Endpoints

## Frontend

| Ruta | Archivo | Propósito |
|------|---------|-----------|
| `/` | `page.tsx` | Single-page app — renderiza `<Wizard />` |

## API Routes (Next.js App Router)

| Endpoint | Método | Propósito |
|----------|--------|-----------|
| `/api/auth/register` | POST | Crear usuario Supabase confirmado desde servidor usando Admin Auth (`email_confirm: true`) |
| `/api/upload` | POST | Preview XLSX (columnas, sample rows, mapping detectado) |
| `/api/companies` | GET | Listar compañías (ordenadas por legal_name) |
| `/api/companies` | POST | Crear compañía (unique legal_name) |
| `/api/companies/[id]` | GET | Obtener compañía por ID |
| `/api/companies/[id]` | DELETE | Eliminar compañía |
| `/api/workspaces` | GET | Listar workspaces (opcional filter by companyId) |
| `/api/workspaces` | POST | Crear workspace (companyId + taxYear, unique constraint) |
| `/api/workspaces` | PUT | Actualizar estado del workspace |
| `/api/accounts` | GET | Listar cuentas bancarias por compañía |
| `/api/accounts` | POST | Crear cuenta bancaria |
| `/api/accounts/[id]` | PUT | Actualizar cuenta |
| `/api/accounts/[id]` | DELETE | Eliminar cuenta |
| `/api/import` | POST | Importar XLSX: parsea, valida, clasifica, inserta (transaccional) |
| `/api/transactions` | GET | Listar transacciones con filtros (workspaceId, bankAccountId, reviewStatus, needsReview) |
| `/api/classifications` | POST | Bulk approve/exclude/recategorize + log review_events |
| `/api/statements` | GET | Listar statements subidos por workspace |
| `/api/opening-balances` | GET/POST | Obtener/guardar saldos de apertura (OpeningBalanceEntry[]) |
| `/api/export/workbook` | POST | Generar y descargar XLSX (P&L, BS, Cash Rollforward, Reconciliation, Report Status, opcional Tx History 12 cols) |
| `/api/export/memo` | POST | Generar y descargar CPA memo DOCX |

## Notas sobre las Rutas

- Todas las API routes usan `export const runtime = "nodejs"` (no Edge)
- `/api/auth/register` requiere `SUPABASE_SERVICE_ROLE_KEY` server-side. No debe exponerse en `NEXT_PUBLIC_*`.
- `/api/upload` NO guarda el archivo — solo hace preview
- `/api/import` es la única que escribe en BD (transaccional)
- `/api/classifications` registra cada acción en `review_events` (audit log)
- Los endpoints de export devuelven archivos binarios (Content-Disposition: attachment)

## 🔗 Enlaces Relacionados

- [[Arquitectura]]
- [[Flujo de Trabajo]]
- [[Opening Balances]]
- [[Workbook Export]]
- [[Errores Conocidos]] — Problemas conocidos en API
- [[Supabase Auth Signup SMTP 535]]
