---
tags:
  - referencia
  - ui
  - componentes
---
# Componentes UI

## Árbol de Componentes

```
RootLayout (layout.tsx)
└── AppPage (page.tsx)
    └── Wizard (wizard/Wizard.tsx) ─── State Machine (steps 1-6)
        ├── StepIndicator (wizard/StepIndicator.tsx)
        ├── CompanyStep (wizard/CompanyStep.tsx)          [Step 1]
        ├── BankAccountsStep (wizard/BankAccountsStep.tsx) [Step 2]
        ├── UploadStep (wizard/UploadStep.tsx)             [Step 3]
        │   └── ColumnMapper (wizard/ColumnMapper.tsx)     [per file]
        ├── ReviewStep (wizard/ReviewStep.tsx)             [Step 4]
        ├── ReconciliationStep (wizard/ReconciliationStep.tsx) [Step 5]
        └── ResultsStep (wizard/ResultsStep.tsx)           [Step 6]
```

### Wizard.tsx (Container Principal)
- Maneja estado compartido: `company`, `workspace`, `accounts`, `reconciliation`
- Controla la navegación entre pasos
- Callbacks: `handleCompanyComplete`, `handleAccountsComplete`, etc.
- Botón "New Workflow" para reset

### StepIndicator.tsx
- Barra de progreso horizontal
- Estados: `active` (ring resaltado), `completed` (checkmark), `pending` (gris), `warning`
- Click en pasos completados → navega hacia atrás

### CompanyStep.tsx
- Search field para compañías existentes
- Formulario para nueva compañía + año fiscal
- Maneja 409 (duplicado) con mensaje amigable
- Muestra workspaces existentes

### BankAccountsStep.tsx
- CRUD completo de cuentas bancarias
- Campos: name, bank, last 4 digits, type, opening/closing balance
- Validación client-side (4 dígitos, balances numéricos)
- Permite múltiples cuentas

### UploadStep.tsx
- Selector de cuenta destino
- File input (múltiples .xlsx)
- Preview cards por archivo: sheet name, row count, confidence, sample data
- ColumnMapper embebido por archivo
- Import button → POST /api/import
- Resultados: success / partial / error banners
- Detección de duplicados (409)

### ColumnMapper.tsx
- Dropdowns: Date*, Description*, Amount, Debit, Credit, Balance
- Required marca con asterisco
- Amount vs Debit+Credit son mutuamente excluyentes
- Preselecciona mapping detectado del preview

### ReviewStep.tsx
- Dos tabs: "Exceptions" (needs review) + "All Transactions"
- Search/filtro por descripción o categoría
- Tabla: checkbox, date, description, amount, category dropdown, confidence badge, rule name, approve/exclude
- Bulk actions: Select All, Clear, Approve(N), Exclude(N)
- Category dropdown con optgroups (P&L / Balance Sheet)
- Cambiar categoría → auto-approve

### ReconciliationStep.tsx
- Agrupa transacciones por bank_account_id
- Calcula reconciliación con `reconcileAccountPeriod()`
- Tabla: Account, Opening, Movement, Expected Close, Closing, Variance, Status
- Warnings para cuentas no reconciliadas y saldos $0
- Disclaimer de reportes preliminares
- **Opening Balances UI** — Formulario para proveer saldos de apertura (asset/liability/equity) que se guardan vía `/api/opening-balances`

### ResultsStep.tsx
- Summary cards (8-grid): statements, transactions, pending review, report mode, reconciliation ratio, classification ratio, documentation ratio, equation check
- **Alert banners**: unreconciled accounts, incomplete classification, pending documentation, accounting equation failures, suspense items (alertas individuales por check)
- P&L preview: income lines, expense lines, net income
- BS preview: assets, liabilities, equity, balance check (verde/rojo)
- **Cash Rollforward preview**: openingCash, inflows, outflows, calculatedEnding, actualCash, variance
- **Report Mode indicator**: Complete ✓ / Preliminary ⚠ / Bank Activity ℹ
- **Matched Transfers count**: cuántas transferencias internas se matchearon y excluyeron
- Botones de export: "Export Financial Statements" y "Export Financial Statements + Transactions"
- "New workflow" button
- Disclaimer cuando hay warnings

## 🔗 Enlaces Relacionados

- [[Flujo de Trabajo]]
- [[Financial Reporting]]
- [[Transfer Matching]]
- [[Suspense]]
- [[Cash Rollforward]]
- [[Opening Balances]]
- [[Arquitectura]]
- [[Optimizaciones]]
