---
tags:
  - referencia
  - stack
---
# Stack Tecnológico

## Frontend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Next.js | 15.1.8 | Framework (App Router) |
| React | 19.0.0 | UI library |
| TypeScript | 5.7.3 | Lenguaje |
| Tailwind CSS | 3.4.17 | Estilos |
| Zod | 3.24.2 | Validación de schemas |

## Backend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Next.js API Routes | 15.1.8 | Backend endpoints |
| pg | 8.13.1 | PostgreSQL driver |
| PostgreSQL | - | Base de datos (Supabase / Neon) |

## Procesamiento de Datos

| Librería | Versión | Propósito |
|----------|---------|-----------|
| xlsx (SheetJS) | 0.18.5 | Parseo de archivos XLSX |
| exceljs | 4.4.0 | Generación de workbooks XLSX |
| docx | 9.5.1 | Generación de documentos DOCX |
| papaparse | 5.5.2 | Parseo de CSV |
| uuid | 14.0.1 | Generación de IDs |

## Testing

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Vitest | 3.0.5 | Test runner unitario |
| jsdom | 26.0.0 | DOM simulado para tests |
| @vitejs/plugin-react | 6.0.3 | Plugin React para Vitest |
| @playwright/test | 1.61.1 | E2E testing |
| @testing-library/react | 16.2.0 | Testing de componentes React |

## Herramientas de Desarrollo

| Herramienta | Versión |
|-------------|---------|
| Node.js | 24.x |
| pnpm | 11.7.0 |
| TypeScript | 5.7.3 |

## Infraestructura

| Servicio | Propósito |
|----------|-----------|
| Vercel | Hosting Next.js |
| Supabase / Neon | PostgreSQL hosting |

## Vercel Demo MVP V2

- Proyecto Vercel: `arres1523/ai-financials-for-cpa-web`
- Branch demo: `MvpV2`
- Preview recomendado: [ai-financials-for-cpa-web-git-mvpv2-arres1523.vercel.app](https://ai-financials-for-cpa-web-git-mvpv2-arres1523.vercel.app)
- Production actual: [ai-financials-for-cpa-web.vercel.app](https://ai-financials-for-cpa-web.vercel.app)
- Variables verificadas en Vercel:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Variables pendientes si se prueba email delivery:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`

## 🔗 Enlaces Relacionados

- [[Arquitectura]]
- [[Notas del Proyecto]]
- [[Glosario]]
- [[Demo Vercel MVP V2]]
