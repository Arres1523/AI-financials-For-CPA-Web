---
tags:
  - metodologia
  - flujo
---
# Flujo de Trabajo

## Vista General — 6 Pasos

```
[1] Company & Tax Year
    ├── Buscar o crear compañía
    └── Seleccionar o crear workspace (año fiscal)
            │
            ▼
[2] Bank Accounts
    ├── Agregar cuentas bancarias
    ├── Tipo: Checking / Savings / Credit Card / Money Market
    └── Balances de apertura y cierre
            │
            ▼
[3] Upload
    ├── Seleccionar cuenta destino
    ├── Subir archivo(s) XLSX
    ├── Mapear columnas (Date*, Description*, Amount | Debit+Credit, Balance)
    └── Importar (parsea, valida año fiscal, clasifica, inserta)
            │
            ▼
[4] Review
    ├── Pestaña "Exceptions" → transacciones pendientes de revisión (baja confianza)
    ├── Pestaña "All Transactions"
    ├── Aprobar / Excluir / Recategorizar individual o bulk
    └── Categorías agrupadas en P&L vs Balance Sheet
            │
            ▼
[5] Reconciliation
    ├── Agrupa por cuenta bancaria
    ├── Calcula: Apertura + Movimiento - Cierre = Variación
    └── Muestra estado: "Reconciled" / "Unreconciled"
            │
            ▼
[6] Results & Export
    ├── Resumen: statements, transacciones, pendientes, modo de reporte
    ├── Alertas: cuentas no reconciliadas, clasificación incompleta, documentación pendiente, ecuación contable, suspenso
    ├── Preview: P&L, Balance Sheet, Cash Rollforward
    ├── Modos de reporte (automáticos):
    │   ├── "classified_bank_activity" → sin BS apertura
    │   ├── "preliminary_balance_sheet" → BS apertura presente pero hay issues
    │   └── "complete_balance_sheet" → todo satisfecho
    ├── Transfer Matching automático (excluye transfers internos del P&L/BS)
    ├── Exportar workbook XLSX:
    │   ├── P&L + BS + Cash Rollforward + Reconciliation + Report Status
    │   └── Transaction History con 12 columnas de auditoría (opcional)
    └── Exportar CPA memo DOCX
```

## Opening Balances (Step 5.5)

Antes de llegar a Results, el usuario puede proveer saldos de apertura:
- Se almacenan en `opening_balance_entries` (asset/liability/equity)
- Se validan con `validateOpeningBalanceSheet()` (A - L = E ≈ 0)
- Habilitan modos de reporte más completos

## Flujo de Datos en Importación

```
1. Cliente lee archivo → ArrayBuffer (useRef)
2. POST /api/upload → Preview (columnas, sample rows, confianza)
3. Usuario mapea columnas → Client-side state
4. POST /api/import → Server-side:
   a. Hash SHA-256 → detecta duplicados
   b. Parse XLSX (SheetJS, primera hoja)
   c. Validar fechas (año fiscal estricto)
   d. Clasificar cada transacción (reglas deterministas)
   e. Transacción BD: statement + transactions + classifications
5. Response → UI muestra resultados (success / partial / error)
```

## Estados del Workspace

- `in_progress` — Durante el flujo activo
- `completed` — Al finalizar (workbook exportado)

## 🔗 Enlaces Relacionados

- [[Arquitectura]]
- [[Financial Reporting]]
- [[Transfer Matching]]
- [[Suspense]]
- [[Cash Rollforward]]
- [[Opening Balances]]
- [[Clasificación de Transacciones]]
- [[Componentes UI]]
- [[Errores Conocidos]]
