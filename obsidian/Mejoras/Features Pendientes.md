---
tags:
  - mejora
  - feature
---
# Features Pendientes

## Por Implementar

### WebLLM — AI Local en Browser
**Archivos relacionados:** `src/domain/classification.ts`
**Descripción:** Ejecutar un modelo de lenguaje pequeño (LLM) en el browser del usuario para clasificar transacciones con mayor precisión. Los datos nunca salen del navegador.
**Estado:** Diseñado en spec original, diferido del MVP.
**Dependencias:** `webllm` package, ~50-200MB download para el modelo.

### Reglas de Clasificación por Compañía
**Archivos relacionados:** `src/domain/classification.ts`, tabla `classification_rules`
**Descripción:** Permitir que cada compañía tenga reglas personalizadas. UI para crear/editar patrones regex y asignar categorías.
**Estado:** Tabla existe en BD pero no se usa. Sin UI.
**Bloqueante:** Requiere UI de gestión de reglas.

### Soporte CSV en UploadStep
**Archivos relacionados:** `src/domain/importCsv.ts`, `src/components/wizard/UploadStep.tsx`
**Descripción:** El dominio ya parsea CSV pero la UI solo acepta `.xlsx`. Agregar `.csv` al file input y usar `importCsv.ts`.
**Estado:** Código del dominio listo, UI pendiente.

### Multi-Sheet Import
**Archivos relacionados:** `src/domain/importXlsx.ts`
**Descripción:** Dejar al usuario elegir qué hoja del XLSX importar (actual: siempre primera).
**Estado:** Preview ya muestra sheet names. Falta selector en UI y adaptar import.

### Dashboard Multi-Compañía
**Descripción:** Vista general de todas las compañías con estado de cada workspace, indicadores de progreso.
**Estado:** Sin implementar.

### Document Checklist UI
**Descripción:** UI para trackear los 8 folders estándar de Valoris (ver `chartOfAccounts.ts`).
**Estado:** Solo existe la constante `VALORIS_DOCUMENT_CHECKLIST`. Sin UI.

## Mejoras a Features Existentes

| Feature | Mejora Propuesta | Prioridad |
|---------|-----------------|-----------|
| Column Mapping | Auto-detectar formato de fecha (DD/MM vs MM/DD) | Alta |
| Review Step | Filtros avanzados (por cuenta, por rango de fechas, por categoría) | Media |
| Review Step | Vista de edición inline de descripción | Baja |
| Reconciliation | Explicación textual de variaciones | Media |
| Export | Logo de Valoris + estilos profesionales | Alta |
| Export | Formato PDF además de XLSX | Baja |
| Upload | Drag & drop zone | Media |
| Wizard | Persistencia de estado (recuperar después de cerrar browser) | Media |

## 🔗 Enlaces Relacionados

- [[Roadmap]]
- [[Optimizaciones]]
- [[Deuda Técnica]]
