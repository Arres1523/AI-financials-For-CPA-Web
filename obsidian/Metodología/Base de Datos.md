---
tags:
  - metodologia
  - base-de-datos
---
# Base de Datos

## Stack

- **Motor:** PostgreSQL (pg library)
- **Provider:** Supabase / Neon
- **Sin ORM** — Consultas SQL directas con helper `query()`, `queryOne()`, `execute()`
- **Migraciones:** Embebidas en `src/lib/db.ts`, se ejecutan `CREATE TABLE IF NOT EXISTS` en orden

## Migraciones

| Versión | Descripción |
|---------|-------------|
| `v1_initial` | 8 tablas base (companies, workspaces, bank_accounts, uploaded_statements, transactions, classifications, classification_rules, review_events, report_exports) |
| `v2_duplicate_fingerprint` | Índices para detección de duplicados (file_hash, transaction fingerprint) |

### Cómo se ejecutan

```typescript
// src/lib/db.ts — Auto-migración en init
const MIGRATIONS = [
  { name: "v1_initial", sql: `CREATE TABLE IF NOT EXISTS ...` },
  { name: "v2_duplicate_fingerprint", sql: `CREATE INDEX IF NOT EXISTS ...` },
];
// Se ejecutan secuencialmente, trackeadas en tabla _migrations
```

## Helper Functions

| Función | Propósito |
|---------|-----------|
| `query(sql, params?)` | Retorna todas las filas |
| `queryOne(sql, params?)` | Retorna una fila o null |
| `execute(sql, params?)` | Sin retorno (INSERT/UPDATE/DELETE) |
| `getClient()` | PoolClient para transacciones |
| `withTransaction(fn)` | BEGIN/COMMIT/ROLLBACK wrapper |
| `getPool()` | Pool inicializado (lazy singleton) |
| `closePool()` | Cierra el pool |
| `resetDb()` | Para testing |
| `runMigrations()` | Ejecuta migraciones pendientes |

## Esquema Detallado

Ver [[Esquema de BD]] para el detalle completo de tablas, columnas y relaciones.

## Patrones de Acceso

- **Conexión diferida (lazy singleton):** Pool se crea en primer uso con resolución DNS
- **Transacciones atómicas:** `withTransaction()` para import (statement + transactions + classifications en una transacción)
- **Detección de duplicados:** Hash SHA-256 a nivel archivo, fingerprint (date|description|amount) a nivel transacción
- **Año fiscal estricto:** WHERE clause filtra transacciones fuera del año

## 🔗 Enlaces Relacionados

- [[Esquema de BD]] — Detalle de tablas y columnas
- [[Deuda Técnica]] — Mejoras pendientes en BD
- [[Decisiones Técnicas]] — Por qué PostgreSQL sin ORM
