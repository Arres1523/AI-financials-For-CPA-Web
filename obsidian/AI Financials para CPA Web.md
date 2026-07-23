---
tags:
  - home
  - index
created: 2026-07-13
---

# AI Financials para CPA Web

> **MVP** — Flujo de trabajo financiero anual para CPAs. Procesa estados de cuenta bancarios XLSX, clasifica transacciones automáticamente, permite revisión/reconciliación, y exporta P&L, Balance Sheet, Cash Rollforward y Transaction History con 12 columnas de auditoría.

## 📋 Estado Actual

- **Stack:** Next.js 15 + React 19 + TypeScript + PostgreSQL + Tailwind CSS
- **Estado:** MVP funcional — 6 pasos operativos completos
- **Testing:** Vitest (unit) + Playwright (E2E) + 39 archivos de test
- **Despliegue:** Vercel (Next.js) + Supabase (PostgreSQL)
- **Última actualización:** 2026-07-22 — Resend Email Integration + Auth/RLS Hardening + Custom SMTP

## 🧭 Navegación Rápida

### Metodología
- [[Arquitectura]] — Visión general de la arquitectura del sistema
- [[Flujo de Trabajo]] — Los 6 pasos del wizard de principio a fin
- [[Clasificación de Transacciones]] — Motor de clasificación determinista por reglas
- [[Financial Reporting]] — Modos de reporte, controles y generación del FinancialReport
- [[Transfer Matching]] — Detección de transferencias internas entre cuentas
- [[Suspense]] — Transacciones en suspenso que bloquean reportes completos
- [[Cash Rollforward]] — Reconciliación cash vs transacciones
- [[Opening Balances]] — Validación de saldos de apertura (Balance Sheet)
- [[Category Options]] — Taxonomía canónica de 25 categorías
- [[Review Policy]] — Política de revisión y estados de documentación
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
- [[Resend Email Integration]] — Issues y contexto de la integración de email

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
- [[Workbook Export]] — Formato del XLSX exportado (P&L, BS, Tx History 12 cols, Cash Rollforward)

## 🏷️ Tags Principales

`#metodologia` `#observacion` `#error` `#mejora` `#referencia` `#arquitectura` `#base-de-datos` `#api` `#testing` `#clasificacion` `#ui` `#deuda-tecnica` `#reporting` `#suspense` `#transfer-matching` `#cash-rollforward` `#opening-balances` `#category-options` `#workbook`

## 🔗 Enlaces Externos

- [Código fuente](./) — `src/` del proyecto Next.js
- [README](../README.md) — Documentación principal del proyecto
- [Design Spec](../docs/superpowers/specs/2026-07-13-ai-financial-statement-generator-design.md)
- [Implementation Plan](../docs/superpowers/plans/2026-07-13-annual-cpa-package-mvp.md)
- [Reporting Redesign Plan](../docs/superpowers/plans/2026-07-14-reporting-redesign.md)
- [Reporting Redesign Design Spec](../docs/superpowers/specs/2026-07-14-reporting-redesign-design.md)
- [Resend Email Integration Design Spec](../docs/superpowers/specs/2026-07-22-resend-email-integration-design.md)
- [Resend Email Integration Plan](../docs/superpowers/plans/2026-07-22-resend-email-integration.md)
- [Auth/RLS Hardening Plan](../docs/superpowers/plans/2026-07-16-auth-rls-hardening.md)
- [Auth/RLS Hardening Design Spec](../docs/superpowers/specs/2026-07-16-auth-rls-hardening-design.md)
