---
tags:
  - referencia
  - glosario
---
# Glosario

## Términos del Dominio

| Término | Definición |
|---------|------------|
| **Company** | Entidad legal (LLC) para la cual se prepara el paquete CPA |
| **Workspace** | Espacio de trabajo anual para una compañía (compañía + año fiscal) |
| **Bank Account** | Cuenta bancaria asociada a una compañía (Checking, Savings, Credit Card, Money Market) |
| **Statement** | Archivo XLSX subido con el detalle de transacciones bancarias |
| **Transaction** | Movimiento individual en un estado de cuenta (fecha, descripción, monto) |
| **Classification** | Categoría asignada a una transacción (ej. "Rental Income", "Utilities") |
| **Report Type** | Tipo de reporte: `P&L` (Income Statement) o `Balance Sheet` |
| **Confidence** | Nivel de confianza de la clasificación: HIGH (auto-aprobado), MEDIUM (revisión), LOW (revisión, baja confianza) |
| **Review Status** | Estado de revisión: `pending`, `approved`, `excluded` |
| **Reconciliation** | Proceso de verificar que saldo inicial + movimientos = saldo final |
| **P&L** | Profit & Loss Statement / Estado de Resultados |
| **Balance Sheet** | Balance General (preliminar, basado en actividad bancaria) |
| **Balance Check** | Diferencia: Total Assets - Total Liabilities - Total Equity. Debe ser $0. |
| **CPA Memo** | Documento de resumen para el CPA con notas sobre el paquete |

## Términos Técnicos

| Término | Definición |
|---------|------------|
| **Fiscal Year** | Año fiscal seleccionado para el workspace. Solo se importan transacciones de este año. |
| **Column Mapping** | Mapeo de columnas del XLSX a campos del sistema (Date, Description, Amount, etc.) |
| **Fingerprint** | Hash único por transacción (date + description + amount) para detectar duplicados |
| **Transfer Clearing** | Categoría por defecto para transferencias entre cuentas y transacciones no clasificadas |
| **WebLLM** | Tecnología planeada para ejecutar AI localmente en el browser |

## Categorías del Chart of Accounts

### P&L (Income Statement)
- Rental Income
- Other Income
- Rent Expense
- Repairs & Maintenance
- Utilities
- Insurance
- Property Taxes
- Legal & Accounting
- Management Fees
- Bank Fees
- Interest Expense
- Other Expense
- K-1 / Tax Items

### Balance Sheet
- Capital Improvements
- Owner Contributions
- Owner Distributions
- Credit Card Liability
- Loan Liability
- Related Party (Due To/From)
- Transfer Clearing

## Convenciones de Código

| Término | Significado |
|---------|-------------|
| `@/` | Path alias → `./src/` |
| `"use client"` | Componente client-side (Next.js) |
| `export const runtime = "nodejs"` | API route en Node.js (no Edge) |

## 🔗 Enlaces Relacionados

- [[Stack Tecnológico]]
- [[Notas del Proyecto]]
- [[Clasificación de Transacciones]]
