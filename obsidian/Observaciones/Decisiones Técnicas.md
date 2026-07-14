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

## 🔗 Enlaces Relacionados

- [[Arquitectura]]
- [[Deuda Técnica]]
- [[Features Pendientes]]
