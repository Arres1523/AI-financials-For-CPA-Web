---
tags:
  - observacion
  - proyecto
---
# Notas del Proyecto

## Contexto del Proyecto

- **Cliente:** Valoris (firma CPA)
- **Producto:** SaaS para preparar paquetes anuales de CPA para LLCs de real estate
- **Usuarios:** CPAs que necesitan procesar estados bancarios de clientes y producir reportes financieros preliminares
- **Tono del producto:** Sobrio, profesional, sin colores llamativos. Paleta: ink (#17212b), paper (#f7f8fa), line (#d8dde5), sage (#5d7668), brass (#9a7b2f)

## Historia del Proyecto

1. **Fase 1 (MVP actual):** Next.js + PostgreSQL (Supabase). Migración desde `better-sqlite3` que fallaba en Vercel (SQLITE_READONLY).
2. **Migración Turso planeada:** Se evaluó Turso/libSQL pero se optó por PostgreSQL directo.
3. **MVP actual:** Determinista, sin AI, 6 pasos funcionales, tests completos.

## Convenciones del Código

| Convención | Estándar |
|------------|----------|
| Naming archivos | `camelCase.ts` — `kebab-case` para rutas |
| Imports | Path alias `@/` → `./src/` |
| Componentes | Functional Components, `"use client"` |
| Tipos | Interfaces en `src/domain/types.ts` |
| Validación | Zod en API routes |
| Commits | Sin convención específica (ver git log) |

## Entorno de Desarrollo

```bash
Node.js 24.x
pnpm 11.7.0
PostgreSQL (local o Supabase)
```

## Datos de Prueba

Los fixtures XLSX en `tests/fixtures/` contienen transacciones de ejemplo:
- `chase_sample.xlsx` → 8 transacciones (rental income, bank fee, capital contribution, AMEX payment, capital improvement, legal, utility, interest)
- `amex_sample.xlsx` → 3 transacciones
- Valores y descripciones diseñados para activar reglas de clasificación específicas

## Paleta de Colores (Tailwind)

```typescript
// tailwind.config.ts
colors: {
  ink: '#17212b',    // Texto oscuro
  paper: '#f7f8fa',  // Fondo
  line: '#d8dde5',   // Bordes
  sage: '#5d7668',   // Acentos verdes
  brass: '#9a7b2f',  // Warnings dorados
}
```

## 🔗 Enlaces Relacionados

- [[Stack Tecnológico]]
- [[Glosario]]
- [[Roadmap]]
