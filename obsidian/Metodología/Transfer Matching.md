---
tags:
  - metodologia
  - transfer-matching
---
# Transfer Matching

## Archivo

`src/domain/transferMatching.ts`

## Propósito

Detectar transferencias internas entre cuentas bancarias de la misma compañía y excluirlas de los reportes P&L y Balance Sheet. Los transfers internos no son ingresos ni gastos — son movimientos de balance.

## Cómo Funciona

`matchInternalTransfers(transactions, bankAccounts)`

### Paso 1: Identificar transfers salientes
Regex aplicado a la descripción de cada transacción con monto negativo (outgoing):
- `TRANSFER.*BETWEEN`
- `TRF TO/FROM`
- `ACCT TRANSFER`
- `INTERNAL TRANSFER`
- `ONLINE TRANSFER`

### Paso 2: Buscar matching
Para cada outgoing, busca un incoming (monto positivo) en una cuenta diferente:
- Monto aproximadamente igual (±1 centavo, `amountTolerance`)
- Dentro de ±3 días (`maxDateDiffDays`)
- Misma cuenta NO — debe ser inter-cuenta

### Paso 3: Retornar
```typescript
{
  matchedPairs: MatchedTransferPair[]   // outTxId, inTxId, amount, dateDiffDays
  unmatchedTransfers: Transaction[]     // transfers no matcheados
}
```

## Configuración

| Parámetro | Default | Descripción |
|-----------|---------|-------------|
| `maxDateDiffDays` | 3 | Días máximos entre transfer saliente y entrante |
| `amountTolerance` | 0.01 | Tolerancia en dólares para montos coincidentes |

## Integración

En `buildFinancialReport()`:
1. Se corre `matchInternalTransfers()` primero
2. Los `matchedPair` transaction IDs se excluyen de `buildReports()`
3. El contador se muestra en Report Status y ResultsStep

## 🔗 Enlaces Relacionados

- [[Financial Reporting]]
- [[Clasificación de Transacciones]]
- [[Decisiones Técnicas]] — Por qué transfer matching
