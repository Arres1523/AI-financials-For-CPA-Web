---
tags:
  - mejora
  - observacion
  - referencia
---
# MVP Boundaries

## Límites Explícitos del MVP

Estos límites son intencionales y están documentados en el README y en el design spec.

| Aspecto | Límite | Razón |
|---------|--------|-------|
| **XLSX** | Primera hoja solamente | Simplificación. Hojas adicionales → warning |
| **Año fiscal** | Estricto — solo transacciones del año seleccionado | Reduce complejidad |
| **AI** | Sin AI externa — clasificación determinista | Privacidad datos cliente, predictibilidad |
| **Balance Sheet** | Preliminar — basado solo en actividad bancaria | No hay datos contables completos |
| **Journal Entries** | No soportado | Fuera de scope MVP |
| **Tax Basis** | No calculado | Fuera de scope MVP |
| **QuickBooks** | Sin integración | Fuera de scope MVP |
| **Autenticación** | Sin auth — single user | Simplificación para MVP |
| **Multi-usuario** | No soportado | Simplificación |
| **Cloud persistence** | Solo Supabase hosting | Sin sincronización multi-región |

## Tabla `classification_rules`

> Reservada para fase futura — no se usa actualmente. Sin auto-learning.

La tabla existe en la BD pero no hay código que la lea ni UI para gestionarla.

## WebLLM

> Diseñado en el spec original pero diferido del MVP.

Se planea ejecutar un LLM en el browser para clasificación asistida. Los datos del cliente nunca saldrían del navegador.

## Lo que el MVP SÍ Hace Bien

- ✅ Importación de estados bancarios XLSX
- ✅ Column mapping automático + manual
- ✅ Clasificación determinista (21 reglas)
- ✅ Revisión humana con bulk approve/exclude/recategorize
- ✅ Reconciliación por cuenta
- ✅ Export P&L + Balance Sheet + Transaction History
- ✅ CPA memo DOCX
- ✅ Detección de duplicados (hash + fingerprint)
- ✅ Operación transaccional (todo o nada)
- ✅ Tests unitarios + E2E

## 🔗 Enlaces Relacionados

- [[Roadmap]]
- [[Features Pendientes]]
- [[Decisiones Técnicas]]
