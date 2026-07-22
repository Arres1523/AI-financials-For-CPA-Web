---
tags:
  - metodologia
  - cash-rollforward
---
# Cash Rollforward

## Archivo

`src/domain/cashRollforward.ts`

## Propósito

Reconciliar el efectivo real (saldos de cuenta) contra las transacciones registradas. Revela si hay transacciones faltantes o errores.

## Cálculo Puro (Sin Plugs)

```
openingCash     = Σ opening_balances de todas las cuentas
totalInflows    = Σ montos positivos (ingresos registrados)
totalOutflows   = Σ |montos negativos| (egresos registrados)
calculatedEnding = openingCash + totalInflows - totalOutflows
actualCash       = Σ closing_balances de todas las cuentas
variance         = actualCash - calculatedEnding
```

## Output

```typescript
interface CashRollforward {
  openingCash: number
  actualCash: number
  totalInflows: number
  totalOutflows: number
  calculatedEndingCash: number
  variance: number
}
```

## Principio Clave

**Zero plugs.** No se hace ningún ajuste para forzar que cuadre. Si `variance ≠ 0`, hay transacciones faltantes, fechas fuera del período, o errores en los balances. El CPA debe investigar.

## Integración

- Calculado en `buildFinancialReport()` después de todos los demás checks
- Se muestra en ResultsStep como preview
- Se incluye como sheet separado en workbook XLSX

## 🔗 Enlaces Relacionados

- [[Financial Reporting]]
- [[Opening Balances]]
- [[Flujo de Trabajo]] — Step 5 (Reconciliation) + Step 6
- [[Decisiones Técnicas]] — Cash rollforward puro
