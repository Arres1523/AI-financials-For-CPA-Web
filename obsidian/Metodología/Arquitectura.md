---
tags:
  - metodologia
  - arquitectura
---
# Arquitectura

## Vista General

```
Frontend (Next.js App Router)
  ├── Wizard (6-step client-side state machine)
  │   ├── Step 1: Company + Tax Year
  │   ├── Step 2: Bank Accounts (CRUD)
  │   ├── Step 3: Upload + Column Mapping
  │   ├── Step 4: Review Classifications
  │   ├── Step 5: Reconciliation
  │   └── Step 6: Results + Export
  │
  ├── API Routes (Next.js → PostgreSQL)
  │   ├── /api/upload          → Preview XLSX
  │   ├── /api/import          → Import + Classify
  │   ├── /api/companies       → CRUD
  │   ├── /api/workspaces      → CRUD
  │   ├── /api/accounts        → CRUD
  │   ├── /api/transactions    → Query
  │   ├── /api/classifications → Bulk review
  │   ├── /api/statements      → Query
  │   └── /api/export/*        → Generate files
  │
  └── Librerías UI: Tailwind CSS + React 19

Backend (Next.js API Routes)
  ├── Domain Layer (pure functions)
  │   ├── classification.ts    → Motor de reglas
  │   ├── importXlsx.ts        → Parseo XLSX
  │   ├── importCsv.ts         → Parseo CSV
  │   ├── reconciliation.ts    → Matemática de conciliación
  │   ├── reporting.ts         → Agregación P&L / BS
  │   └── cpaPackage.ts        → Estado del paquete
  │
  ├── Export Layer
  │   ├── workbook.ts          → ExcelJS (P&L, BS, Tx History)
  │   └── cpaMemo.ts           → docx (CPA memo)
  │
  └── Database Layer
      └── lib/db.ts            → pg pool + migraciones automáticas

Infrastructure
  ├── Vercel (hosting Next.js)
  └── Supabase / Neon (PostgreSQL)
```

## Principios Arquitectónicos

1. **Single-Page Wizard** — Toda la funcionalidad en una sola ruta con máquina de estados cliente.
2. **Domain Layer Aislado** — Lógica de negocio en `src/domain/` como funciones puras sin dependencias UI/framework.
3. **API Routes Delgadas** — Controladores que parsean request, llaman al dominio, interactúan con BD y devuelven JSON.
4. **PostgreSQL + Migraciones Embebidas** — Sin ORM. Las migraciones se ejecutan automáticamente al conectar.
5. **Clasificación Determinista** — Sin AI externa. 100% basada en reglas con regex.
6. **Disclaimer Preliminar** — Todos los reportes advierten que son preliminares.

## 📁 Estructura de Archivos Clave

| Ruta | Propósito |
|------|-----------|
| `src/app/page.tsx` | Punto de entrada único, renderiza `<Wizard />` |
| `src/components/wizard/` | Componentes del wizard (8 archivos) |
| `src/domain/` | Lógica de negocio (7 archivos) |
| `src/exports/` | Generación de archivos (2 archivos) |
| `src/lib/db.ts` | Conexión PostgreSQL + migraciones |
| `src/app/api/` | Rutas API (12 endpoints) |
| `tests/` | Tests unitarios + fixtures |
| `e2e/` | Tests end-to-end Playwright |

## 🔗 Enlaces Relacionados

- [[Flujo de Trabajo]]
- [[Base de Datos]]
- [[API Endpoints]]
- [[Decisiones Técnicas]]
