---
tags:
  - error
  - deuda-tecnica
  - mejora
---
# Deuda Técnica

## 🔴 Alta Prioridad

### 1. Sin Manejo de Errores Global en API Routes
**Dónde:** `src/app/api/*/route.ts`
**Problema:** Cada API route maneja errores individualmente. No hay un error handler global.
**Impacto:** Respuestas de error inconsistentes, riesgo de leak de stack traces.
**Solución Propuesta:** Middleware o wrapper function para try/catch global.

### 2. Falta de Rate Limiting
**Dónde:** API Routes
**Problema:** No hay protección contra abuso de endpoints (especialmente POST).
**Impacto:** Riesgo de seguridad en producción.
**Solución Propuesta:** `@upstash/ratelimit` o middleware Vercel.

### 3. Validación de Input Duplicada Sin Esquema Unificado
**Dónde:** Client-side (React) + Server-side (Zod)
**Problema:** Las validaciones existen en ambos lados pero no comparten un esquema.
**Impacto:** Riesgo de inconsistencia, más código a mantener.

## 🟡 Media Prioridad

### 4. Tests de Integración Condicionales
**Dónde:** `tests/api/import-flow.test.ts`
**Problema:** Requiere servidor corriendo → no se ejecutan en CI normal.
**Impacto:** Los tests de integración rara vez se corren.
**Solución Propuesta:** Mock del pool de BD para integrar con Vitest.

### 5. Código CSV Sin Integrar en UI
**Dónde:** `src/domain/importCsv.ts`
**Problema:** El dominio soporta CSV pero la UI solo acepta XLSX.
**Impacto:** Código muerto o feature incompleta.
**Solución Propuesta:** Decidir si integrar CSV en UI o remover el código.

### 6. Tipado Débil en API Query Params
**Dónde:** API Routes con filtros (query string)
**Problema:** Los query params llegan como `string | null` sin tipado.
**Impacto:** Riesgo de errores en runtime.

## 🟢 Baja Prioridad

### 7. Sin Test de Accesibilidad
**Problema:** No hay tests de a11y (aria labels, keyboard navigation, screen readers).
**Impacto:** Excluye usuarios con discapacidades.

### 8. Sin CI/CD Pipeline
**Problema:** No hay GitHub Actions configuradas para CI.
**Impacto:** Tests se corren manualmente.

### 9. Sin Environment Validation al Startup
**Dónde:** `src/lib/db.ts`
**Problema:** Si `DATABASE_URL` falta, el error aparece recién al primer query.
**Impacto:** Debugging difícil en deploy.

### 10. Sin Documentación de API
**Problema:** No hay OpenAPI/Swagger specs.
**Impacto:** Dependencia del código fuente para entender la API.

## Métricas de Deuda Técnica

| Aspecto | Estado | Meta |
|---------|--------|------|
| TypeScript strict | ✅ `strict: true` | Mantener |
| ESLint | ❌ No configurado | Agregar `@typescript-eslint` |
| Prettier | ❌ No configurado | Agregar |
| Husky / pre-commit | ❌ No configurado | Agregar lint-staged |
| CI/CD | ❌ No configurado | GitHub Actions |
| Error boundary React | ❌ No implementado | Agregar |
| Logging estructurado | ❌ Solo console.log | Winston / pino |

## 🔗 Enlaces Relacionados

- [[Optimizaciones]]
- [[Features Pendientes]]
- [[Errores Conocidos]]
