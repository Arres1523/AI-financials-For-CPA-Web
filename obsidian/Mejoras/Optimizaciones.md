---
tags:
  - mejora
  - optimizacion
---
# Optimizaciones

## Performance

### Importación de Archivos Grandes (>1000 filas)
**Problema:** No hay límite de filas. Archivos grandes pueden causar timeout en Vercel (10s).
**Propuesta:**
- [ ] Implementar procesamiento por lotes (chunks de 500)
- [ ] Mostrar progreso en UI (WebSocket o polling)
- [ ] Agregar límite configurable de filas

### Renderizado de Wizard
**Problema:** El wizard renderiza todos los pasos (los oculta con CSS).
**Propuesta:**
- [ ] Lazy loading de pasos — solo renderizar el paso activo
- [ ] Code splitting por paso

### Queries a BD
**Problema:** Múltiples queries secuenciales en algunos endpoints.
**Propuesta:**
- [ ] Revisar N+1 queries en listados (ej. transactions + classifications)
- [ ] Agregar JOINs donde sea posible
- [ ] Paginación en endpoints de listado

## Developer Experience (DX)

### CI/CD
- [ ] GitHub Actions: lint + typecheck + test en cada PR
- [ ] Playwright en CI contra preview deployment

### Tooling
- [ ] ESLint + Prettier config
- [ ] Husky + lint-staged (pre-commit hooks)
- [ ] Script de reset de BD para desarrollo

### Monitoreo
- [ ] Logging estructurado (pino / winston)
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring (Vercel Analytics)

## Seguridad

| Mejora | Prioridad |
|--------|-----------|
| Rate limiting en API | 🔴 Alta |
| Validación de tamaño de archivo (límite 10MB) | 🔴 Alta |
| Sanitización de inputs | 🟡 Media |
| CSP Headers | 🟡 Media |
| Autenticación | 🟢 Baja (deferida) |

## Testing

| Mejora | Prioridad | Estado |
|--------|-----------|--------|
| Tests de integración automáticos (no condicionales) | 🔴 Alta | ❌ |
| Tests de accesibilidad (a11y) | 🟡 Media | ❌ |
| Property-based testing para clasificación | 🟢 Baja | ❌ |
| Visual regression tests (Playwright snapshot) | 🟢 Baja | ❌ |
| Tests de performance (carga de archivos grandes) | 🟡 Media | ❌ |

## 🔗 Enlaces Relacionados

- [[Deuda Técnica]]
- [[Features Pendientes]]
- [[Roadmap]]
