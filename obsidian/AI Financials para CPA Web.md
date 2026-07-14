---
tags:
  - home
  - index
created: 2026-07-13
---

# AI Financials para CPA Web

> **MVP** — Flujo de trabajo financiero anual para CPAs. Procesa estados de cuenta bancarios XLSX, clasifica transacciones automáticamente, permite revisión/reconciliación y exporta P&L y Balance Sheet preliminares.

## 📋 Estado Actual

- **Stack:** Next.js 15 + React 19 + TypeScript + PostgreSQL + Tailwind CSS
- **Estado:** MVP funcional — 6 pasos operativos completos
- **Testing:** Vitest (unit) + Playwright (E2E)
- **Despliegue:** Vercel (Next.js) + Supabase (PostgreSQL)

## 🧭 Navegación Rápida

### Metodología
- [[Arquitectura]] — Visión general de la arquitectura del sistema
- [[Flujo de Trabajo]] — Los 6 pasos del wizard de principio a fin
- [[Clasificación de Transacciones]] — Motor de clasificación determinista por reglas
- [[Base de Datos]] — Esquema, migraciones y patrones de acceso
- [[API Endpoints]] — Rutas de la API REST
- [[Testing]] — Estrategia y cobertura de tests

### Observaciones
- [[Decisiones Técnicas]] — Arquitectura, porqués y trade-offs
- [[Patrones de Diseño]] — Patrones usados en el código
- [[Notas del Proyecto]] — Notas generales y contexto del proyecto

### Errores y Problemas
- [[Errores Conocidos]] — Bugs y problemas identificados
- [[Edge Cases]] — Casos borde a considerar
- [[Deuda Técnica]] — Cosas pendientes por mejorar

### Mejoras
- [[Roadmap]] — Próximos pasos y visión a futuro
- [[Features Pendientes]] — Funcionalidades planeadas
- [[Optimizaciones]] — Mejoras de rendimiento y DX
- [[MVP Boundaries]] — Límites explícitos del MVP

### Referencia
- [[Stack Tecnológico]] — Tecnologías y versiones
- [[Esquema de BD]] — Tablas, columnas y relaciones
- [[Componentes UI]] — Árbol de componentes del wizard
- [[Glosario]] — Términos y definiciones del dominio

## 🏷️ Tags Principales

`#metodologia` `#observacion` `#error` `#mejora` `#referencia` `#arquitectura` `#base-de-datos` `#api` `#testing` `#clasificacion` `#ui` `#deuda-tecnica`

## 🔗 Enlaces Externos

- [Código fuente](./) — `src/` del proyecto Next.js
- [README](../README.md) — Documentación principal del proyecto
- [Design Spec](../docs/superpowers/specs/2026-07-13-ai-financial-statement-generator-design.md)
- [Implementation Plan](../docs/superpowers/plans/2026-07-13-annual-cpa-package-mvp.md)
