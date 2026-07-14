---
tags:
  - mejora
  - roadmap
---
# Roadmap

## Visión General

```
MVP Actual ──► Fase 2 ──► Fase 3 ──► V1
  (Jul 2026)    (Q3 2026)  (Q4 2026)   (2027)
```

## ✅ MVP Actual (Completado)

- [x] Wizard de 6 pasos funcional
- [x] Importación XLSX con column mapping
- [x] Clasificación determinista (reglas)
- [x] Revisión y recategorización
- [x] Reconciliación bancaria
- [x] Exportación P&L + Balance Sheet (XLSX)
- [x] Exportación CPA memo (DOCX)
- [x] Tests unitarios + E2E
- [x] PostgreSQL (Supabase)
- [x] Detección de duplicados

## 🚧 Fase 2 — Mejoras Core

### Prioridad Alta
- [ ] **WebLLM (AI local en browser)** — Clasificación asistida por AI sin enviar datos a servidores externos
- [ ] **Reglas por compañía** — Activar `classification_rules` table con UI de gestión
- [ ] **Soporte CSV en UI** — Integrar `importCsv.ts` en el UploadStep
- [ ] **Multi-sheet XLSX** — Dejar al usuario elegir qué hoja importar
- [ ] **Exportar con formato mejorado** — Estilos profesionales, logos, encabezados

### Prioridad Media
- [ ] **Error handling global** — Middleware para API routes
- [ ] **Rate limiting** — Protección contra abuso
- [ ] **Validación unificada** — Esquemas compartidos cliente/servidor

## 🔮 Fase 3 — Features Avanzadas

- [ ] **Autenticación** — Multi-usuario con roles (CPA admin, staff, client?)
- [ ] **Múltiples compañías** — Dashboard con vista de portafolio
- [ ] **Comparativa año contra año** — Multi-period reporting
- [ ] **Document Check List** — UI para trackear documentos del CPA package
- [ ] **Notas y comentarios** — Anotaciones del CPA en transacciones
- [ ] **Template de chart of accounts** — Configurable por cliente

## 🌟 V1 — Producto Completo

- [ ] **QuickBooks / Xero integration** — Sync automático
- [ ] **AI learning** — El modelo mejora con correcciones del usuario
- [ ] **Trial Balance import** — Para Balance Sheet completo (no solo bank activity)
- [ ] **Journal entries** — Ajustes manuales del CPA
- [ ] **Tax basis reporting** — Reportes en base imponible
- [ ] **Portal de cliente** — El cliente sube docs, el CPA revisa

## 📋 No Planeado (Explicitamente Fuera de Scope)

- OCR / PDF parsing
- Payroll processing
- Tax return preparation
- Multi-entity consolidation
- Real-time bank feeds (Plaid)

## 🔗 Enlaces Relacionados

- [[Features Pendientes]]
- [[Optimizaciones]]
- [[MVP Boundaries]]
