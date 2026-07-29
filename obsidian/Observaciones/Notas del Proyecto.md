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

1. **Fase 1 (MVP inicial):** Next.js + PostgreSQL (Supabase). Migración desde `better-sqlite3` que fallaba en Vercel (SQLITE_READONLY).
2. **Migración Turso planeada:** Se evaluó Turso/libSQL pero se optó por PostgreSQL directo.
3. **Fase 2 (Reporting Redesign — 2026-07-14):** Expansión mayor del sistema de reportes:
   - 3 modos de reporte (classified_bank_activity → preliminary_balance_sheet → complete_balance_sheet)
   - Transfer matching automático entre cuentas
   - Módulo de suspense como gatekeeper
   - Cash rollforward puro (sin plugs)
   - Opening balances con validación A - L = E
   - Taxonomía canónica de 25 categorías (categoryOptions.ts)
   - Transaction History expandido a 12 columnas de auditoría
   - Review policy centralizado con estados de documentación
   - Workbook XLSX con 5 sheets (Report Status, P&L, BS, Cash Rollforward, Reconciliation)
   - Supabase MCP configurado
4. **MVP V2 CPA Workflow — 2026-07-28:** Expansión según llamada con CPA:
   - Importación CSV, XLSX y PDF text-based.
   - Preclassification y Review como flujo de sugerencia + revisión humana.
   - `SOFTWARE/SUBSCRIPTION` preservado como `Other Expense`, `medium`, `support_needed`.
   - Reglas recurrentes por compañía como sugerencias revisables.
   - Review tabs para exceptions, all transactions, related parties, credit cards, low confidence y unreconciled account.
   - Reconciliation con possible causes y navegación a review filtrado.
   - Corrección auditada de fecha, descripción y monto.
   - Workbook con Statement Files y Review Log.
   - CPA memo con formatos importados, related-party items, variances y limitación PDF text-based.
5. **Demo Vercel — 2026-07-29:** Preview `MvpV2` verificado como Ready para demo externa guiada. Ver [[Demo Vercel MVP V2]].

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
- [[Demo Vercel MVP V2]]
