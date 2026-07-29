---
tags:
  - observacion
  - demo
  - vercel
status: ready-preview
date: 2026-07-29
---
# Demo Vercel MVP V2

## Estado Verificado

> [!success] Preview actualizado
> El branch `MvpV2` está sincronizado con `origin/MvpV2` en el commit `efe144f` (`feat: add CPA review control workflow`). Vercel tiene un Preview Ready creado el 2026-07-28 17:28 COT, inmediatamente después de ese commit.

## URLs Para Mostrar

- Preview estable del branch: [ai-financials-for-cpa-web-git-mvpv2-arres1523.vercel.app](https://ai-financials-for-cpa-web-git-mvpv2-arres1523.vercel.app)
- Deployment específico verificado: [ai-financials-for-cpa-bftfo5gx9-arres1523.vercel.app](https://ai-financials-for-cpa-bftfo5gx9-arres1523.vercel.app)
- Production actual: [ai-financials-for-cpa-web.vercel.app](https://ai-financials-for-cpa-web.vercel.app)

> [!warning] Production no es el enlace recomendado para esta demo
> Production está Ready, pero fue generado antes del último commit de `MvpV2`. Para mostrar lo más reciente, usar el Preview del branch.

## Verificación Técnica Ejecutada

- `git fetch origin && git status --short --branch`: `MvpV2...origin/MvpV2`, sin cambios de código pendientes.
- `vercel whoami`: autenticado como `miguelbolano101-4417`.
- `.vercel/repo.json`: proyecto linkeado a `arres1523/ai-financials-for-cpa-web`.
- `vercel env ls`: variables esenciales presentes en Preview y Production:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- `curl -I` sobre Preview: responde `307` hacia `/login`, esperado por Supabase Auth.

## Limitaciones De Demo

- `RESEND_API_KEY` y `RESEND_FROM_EMAIL` no aparecen configuradas en Vercel. El flujo web principal funciona, pero no se debe prometer prueba pública de emails hasta agregar esas variables.
- La demo necesita un usuario de Supabase válido. Crear un usuario demo antes de enviar el link.
- Revisar Supabase Auth Redirect URLs si se usa register/reset password desde el dominio de Vercel:
  - `https://ai-financials-for-cpa-web-git-mvpv2-arres1523.vercel.app/**`
  - `https://ai-financials-for-cpa-web.vercel.app/**` si se decide promover a Production.
- Usar datos demo o statements anonimizados. No usar statements reales sin anonimizar.

## Guion Recomendado

1. Abrir el Preview del branch.
2. Iniciar sesión con usuario demo.
3. Crear compañía demo y tax year 2025 o 2026.
4. Crear cuenta bancaria con opening y closing balance.
5. Subir CSV/XLSX/PDF text-based.
6. Mostrar mapping de columnas y pre-classification.
7. Mostrar `ReviewStep`:
   - Exceptions.
   - Related Parties.
   - Credit Cards.
   - Low Confidence.
   - Unreconciled Account.
8. Corregir o marcar una transacción como CPA Review / Support Needed.
9. Crear regla recurrente desde una corrección.
10. Ir a Reconciliation y usar `Review transactions`.
11. Ir a Results y mostrar shortcuts.
12. Exportar workbook y memo CPA.

## Mensaje De Posicionamiento

El producto debe mostrarse como MVP funcional en validación CPA:

> Automatiza la importación, preclasificación, revisión y export CPA-ready de estados financieros desde statements bancarios. El enfoque no reemplaza al CPA; hace visible lo delicado, auditable y revisable.

## Pendientes Antes De Demo Externa Fuerte

- Crear usuario demo en Supabase.
- Cargar data demo/anonimizada.
- Confirmar Redirect URLs en Supabase Auth.
- Agregar variables Resend si se desea probar email delivery.
- Decidir si se promueve `MvpV2` a Production o si se comparte solo Preview.

## Enlaces Relacionados

- [[Flujo de Trabajo]]
- [[Stack Tecnológico]]
- [[Review Policy]]
- [[Workbook Export]]
- [[Supabase Auth Signup SMTP 535]]
