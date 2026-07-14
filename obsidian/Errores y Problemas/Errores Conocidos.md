---
tags:
  - error
  - bug
---
# Errores Conocidos

## 🐛 Bugs Identificados

### 1. SQLITE_READONLY en Vercel (RESUELTO)
**Estado:** ✅ Resuelto con migración a PostgreSQL
**Síntoma:** La app fallaba al desplegar en Vercel porque intentaba escribir `data/app.db` en serverless functions (sistema de archivos read-only).
**Solución:** Migrar de `better-sqlite3` a `pg` (PostgreSQL) con Supabase.

### 2. Edge Cases de Fechas en Importación
**Estado:** ⚠️ Parcialmente cubierto por tests
**Descripción:** El parser de fechas maneja números seriales de Excel, ISO strings y formatos US. Pero hay formatos de fecha no cubiertos.
**Archivo:** `src/domain/importXlsx.ts` — `parseDate()`
**Por monitorear:** Formatos DD/MM/YYYY (europeo), fechas con texto (ej. "Jan 15, 2026").

### 3. Column Mapping con Columnas Faltantes
**Estado:** ⚠️ Validación existe pero podría mejorar
**Descripción:** Si el mapping no incluye date+description+amount (o debit+credit), el servidor rechaza con error Zod. La UI muestra el error pero el flujo de recuperación es confuso.

### 4. Duplicados Intra-File
**Estado:** ⚠️ Detectado pero no manejado elegantemente
**Descripción:** El fingerprint detecta filas duplicadas dentro del mismo archivo, pero si hay muchas (ej. archivo corrupto o mal exportado), la respuesta de error es genérica.

## ⚠️ Casos No Cubiertos (Potenciales Bugs)

### Archivos Multi-Sheet
**Comportamiento actual:** Solo importa la primera hoja. Las hojas adicionales se ignoran con un warning en preview.
**Riesgo:** El usuario podría no notar el warning y asumir que todas las hojas se importaron.

### Archivos con Contraseña
**Comportamiento actual:** SheetJS fallará al abrir el archivo.
**Riesgo:** Error no manejado elegantemente — el usuario ve un error genérico.

### Archivos CSV (No Soportado en UI)
**Comportamiento actual:** El dominio tiene `importCsv.ts` pero la UI solo acepta `.xlsx`.
**Riesgo:** El código de CSV existe pero no está integrado → código muerto o feature a medio implementar.

### Rangos de Fechas Mixtos
**Comportamiento actual:** Rechaza transacciones fuera del año fiscal.
**Riesgo:** Si el archivo contiene transacciones de múltiples años, el usuario no sabe cuántas se descartaron sin ver el detalle.

## 🔧 Cómo Reportar Errores

1. Revisar esta lista primero
2. Verificar en tests si el caso está cubierto
3. Si es nuevo, agregar test case en el archivo correspondiente antes de fixear

## 🔗 Enlaces Relacionados

- [[Edge Cases]]
- [[Deuda Técnica]]
- [[Testing]]
