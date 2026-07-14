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

### ResultsStep.tsx
- Summary cards: statements, transactions, pending, balance check
- P&L preview: income lines, expense lines, net income
- BS preview: assets, liabilities, equity, balance check
- Reconciliation status per account
- Botones de export: con/sin Transaction History
- "New workflow" button
- Disclaimer cuando hay warnings

## 🔗 Enlaces Relacionados

- [[Flujo de Trabajo]]
- [[Arquitectura]]
- [[Optimizaciones]]
