---
tags:
  - observacion
  - arquitectura
---
# Decisiones Técnicas

## 🏗️ Arquitectura

### Single-Page Wizard vs Multi-Route
**Decisión:** Single-page con máquina de estados cliente (6 steps en `Wizard.tsx`)
**Por qué:** El flujo es estrictamente secuencial. No hay necesidad de navegación compleja. Simplifica el estado compartido entre pasos.
**Trade-off:** La URL no refleja el estado actual del wizard. No hay deep-linking a pasos específicos.

### Next.js App Router API Routes como Backend
**Decisión:** API Routes en lugar de backend separado
**Por qué:** Simplicidad del monorepo, despliegue unificado en Vercel, misma base de código.
**Trade-off:** No escalable horizontalmente de forma independiente. Las API routes corren en Node.js (no Edge).

### PostgreSQL sin ORM
**Decisión:** `pg` library directa con helper functions
**Por qué:** Control total sobre queries, sin abstracciones, fácil de debuggear, migraciones embebidas simples.
**Trade-off:** Más boilerplate, sin Type Safety automático en queries, sin migrations CLI.

## 💡 Clasificación

### Determinista vs AI
**Decisión:** 100% rule-based (regex), sin AI externa
**Por qué:** Predictibilidad, sin costos de API, sin latencia, sin datos sensibles enviados a terceros.
**Trade-off:** No aprende de correcciones del usuario. La tabla `classification_rules` está preparada para futuro.

### Reglas Hardcodeadas vs Configurables
**Decisión:** Reglas hardcodeadas en `src/domain/classification.ts`
**Por qué:** MVP rápido. La tabla `classification_rules` existe pero no se usa.
**Trade-off:** Para añadir/editar reglas hay que modificar código.

## 📂 Importación

### Primera Hoja Solamente
**Decisión:** Solo se procesa la primera worksheet del XLSX
**Por qué:** Los bancos típicamente ponen el detalle en la primera hoja. Reduce complejidad.
**Trade-off:** Hojas adicionales se ignoran con warning. Podría perderse data.

### Hash SHA-256 para Detección de Duplicados
**Decisión:** Hash a nivel archivo + fingerprint a nivel transacción
**Por qué:** Evita re-importaciones accidentales. Fingerprint previene duplicados dentro del mismo archivo.
**Trade-off:** Archivos idénticos con metadatos diferentes (ej. rename) se detectan igual.

### Lectura Client-Side + ArrayBuffer
**Decisión:** El cliente lee el archivo a ArrayBuffer y lo envía al servidor
**Por qué:** Permite preview inmediato sin re-subir. El buffer se guarda en `useRef` para re-uso.
**Trade-off:** Mayor uso de memoria en cliente.

## 📊 Reportes

### Balance Sheet Preliminar
**Decisión:** El Balance Sheet solo refleja actividad bancaria clasificada
**Por qué:** No hay datos contables completos (activos fijos, cuentas por cobrar/pagar, etc.).
**Trade-off:** Es explícitamente un Balance Sheet parcial. La línea "Balance Check" nunca se maquilla.

### Disclaimers en Todos los Reportes
**Decisión:** Todos los reportes (preview y export) llevan disclaimer de "PRELIMINARY"
**Por qué:** Protección legal y profesional para el CPA. Expectativas claras.
**Trade-off:** Puede percibirse como limitación del producto.

## 🆕 Reporting Redesign (2026-07-14)

### Report Modes (3 niveles)
**Decisión:** `classified_bank_activity` → `preliminary_balance_sheet` → `complete_balance_sheet`
**Por qué:** Gradual disclosure. El CPA ve exactamente qué tan completo está el reporte basado en datos disponibles (opening balances, suspense, reconciliación, ecuación contable, clasificación).
**Trade-off:** Complejidad adicional en la UI. El modo se determina automáticamente, no es configurable.

### Transfer Matching Automático
**Decisión:** Detectar transferencias internas por regex y matching (±3 días, ±1¢) y excluirlas del P&L/BS
**Por qué:** Los transfers entre cuentas propias no son ingresos/gastos. Sin esto, el P&L muestra inflación artificial.
**Trade-off:** Matching imperfecto — transfers con fechas muy distantes o montos exactos no se detectan. El regex puede tener falsos positivos.

### Suspense como Gatekeeper
**Decisión:** Las transacciones en suspenso (no aprobadas, no excluidas, o Uncategorized) bloquean el modo `complete_balance_sheet`
**Por qué:** Un reporte "completo" debería tener todas las transacciones resueltas. El suspense es una señal de que falta review.
**Trade-off:** El CPA puede tener razones legítimas para dejar items sin clasificar. El modo baja automáticamente.

### Cash Rollforward Puro (Sin Plugs)
**Decisión:** `openingCash + inflows - outflows = calculatedEnding`. Si hay diferencia, se muestra como variance. No se maquilla.
**Por qué:** Muestra exactamente la verdad de los datos. El CPA decide si hay transacciones faltantes o errores.
**Trade-off:** Variance puede ser confuso si el usuario espera que "siempre cuadre".

### Opening Balances como Input Opcional
**Decisión:** Los saldos de apertura (asset/liability/equity) se ingresan manualmente en ReconciliationStep y se validan con A - L = E ≈ 0
**Por qué:** Habilitan modos de reporte más ricos (preliminary_balance_sheet, complete_balance_sheet) sin requerir contabilidad completa.
**Trade-off:** Input manual propenso a errores. No hay integración con software contable.

### Category Options como Single Source of Truth
**Decisión:** Extraer la taxonomía de categorías de `classification.ts` a `categoryOptions.ts` con 25 categorías canónicas
**Por qué:** Elimina duplicación entre frontend (ReviewStep select) y backend (classification rules). Centraliza report types.
**Trade-off:** Cambiar la taxonomía requiere modificar código y tests.

### Transaction History con 12 Columnas de Auditoría
**Decisión:** Expandir Tx History de 4 a 12 columnas: Date, Description, Amount, Balance, Bank Account, Category, Report Type, Confidence, Rule Used, Classification Status, Documentation Status, Manual Correction, Review Notes
**Por qué:** Los CPAs necesitan trazabilidad completa para preparar los estados financieros. Cada transacción debe explicarse.
**Trade-off:** Archivos XLSX más grandes. La columna de notas de revisión requiere datos de review_events.

## 🔗 Enlaces Relacionados

- [[Arquitectura]]
- [[Financial Reporting]]
- [[Transfer Matching]]
- [[Suspense]]
- [[Cash Rollforward]]
- [[Opening Balances]]
- [[Category Options]]
- [[Workbook Export]]
- [[Deuda Técnica]]
- [[Features Pendientes]]
