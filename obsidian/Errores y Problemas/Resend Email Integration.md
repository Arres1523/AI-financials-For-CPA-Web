---
tags:
  - error
  - mejora
  - email
  - resend
  - supabase
  - seguridad
created: 2026-07-22
---

# Resend Email Integration — 2026-07-22

> Integración de Resend para emails transaccionales (welcome, reportes) + Custom SMTP en Supabase Auth para reemplazar el provedor default.

## 🔴 Errores y Problemas Encontrados

### 1. SMTP authentication fallaba con "535 Invalid username"
**Archivo:** Configuración SMTP en Supabase (Management API)
**Causa:** Se usó `smtp_pass=re_Pv1TWEAb_2wtmkL3hCirSkiz4GW4m956m` pero el usuario SMTP de Resend no es `resend` sino `api_key`.
**Fix:** Cambiar `smtp_user` a `api_key` (no `resend`). El password es la API Key de Resend.

### 2. Resend free tier solo envía al dueño de la cuenta
**Archivo:** `SMTP_ADMIN_EMAIL = onboarding@resend.dev`
**Problema:** `onboarding@resend.dev` solo puede enviar a `miguelbolano101@gmail.com` (el email que registró la cuenta de Resend). Cualquier otro destinatario causa error 550.
**Fix temporal:** Usar `miguelbolano101@gmail.com` para pruebas.
**Fix permanente:** Verificar un dominio propio en resend.com/domains y cambiar `smtp_admin_email`.

### 3. Rate limit de emails demasiado bajo (2/h)
**Archivo:** Configuración SMTP en Supabase (via Management API)
**Problema:** Supabase Auth tiene un rate limit default de 2 emails por hora.
**Fix:** Subido a 30/h via `GOTRUE_RATE_LIMIT_EMAIL_SENT` en la configuración de Auth.

### 4. SUPABASE_SECRET_KEY expuesta
**Archivo:** `.env.local` / logs de sesión
**Problema:** Durante la depuración, la Service Role Key (`eyJhbGciOiJIUzI1NiIsIsInR5cCI6IkpXVCJ9...`) se mostró en texto plano.
**Riesgo:** Cualquiera con esa clave tiene acceso administrativo total a la base de datos Supabase.
**Fix:** Rotar la clave en Supabase Dashboard → Project Settings → API → Service Role Key → **Revoke**.

### 5. Welcome email endpoint vulnerable a ejecución múltiple
**Archivo:** `src/app/api/emails/welcome/route.ts`
**Problema:** El idempotency key de Resend evita duplicados en Resend, pero el endpoint se puede llamar múltiples veces. El flag `welcome_sent` en `user_metadata` mitiga esto, pero la actualización del metadata puede fallar (hay `.catch(() => {})` silencioso).
**Riesgo:** Si `updateUser` falla, próximos llamados al endpoint intentarán enviar otro welcome email.
**Fix sugerido:** Usar una columna `welcome_email_sent` en `public.profiles` para tracking atómico.

### 6. Report email query filtra por user_id incorrectamente
**Archivo:** `src/app/api/emails/report/route.ts:105`, línea 105
**Problema:** En `accountReconData`, el LEFT JOIN con transactions usa `t.user_id = $2`, lo cual excluye transacciones que no tienen `user_id` (nulo) del cálculo de `movement_total`. El `user_id` se backfilleó al primer usuario, pero nuevas transacciones creadas por la API podrían no tenerlo.
**Además:** El filtro `AND a.user_id = $4` en la misma query para `bank_accounts` también puede excluir cuentas sin user_id.

### 7. Falta de verificación de dueño en queries de workspace
**Archivo:** `src/app/api/emails/report/route.ts:41`
**Problema:** La query de workspace verifica `w.user_id = $2`, pero si el workspace no tiene `user_id` (registros anteriores al backfill), el workspace no se encuentra y retorna 404 aunque exista.

### 8. RLS y SECURITY DEFINER issues detectados por Supabase Advisors
**Archivos:** `public.profiles`, `public._migrations`, `public.handle_new_user()`
**Problemas:**
- `profiles` no tenía RLS habilitado (cualquier authenticated user podía leer/escribir perfiles ajenos)
- `_migrations` no tenía RLS (tabla interna expuesta vía API)
- `handle_new_user()` era `SECURITY DEFINER` ejecutable por `anon` via REST API
**Fix:** REVOKE EXECUTE de anon/authenticated, ENABLE RLS en profiles y _migrations, policies restrictivas.

### 9. Confirm email no llegaba al usuario
**Archivo:** N/A (operacional)
**Problema:** Los correos de confirmación de Supabase enviados via Resend SMTP tienen status "delivered" pero pueden caer en Spam/Promociones por usar `onboarding@resend.dev`.
**Fix:** Revisar carpeta de Spam. Para producción, verificar dominio propio en Resend.

## 🟢 Buenas Prácticas Aplicadas

### 1. Resend client singleton pattern
**Archivo:** `src/lib/resend.ts`
Patrón singleton con lazy initialization. Similar al pool de BD en `db.ts`. Consistente con la base de código.

### 2. Idempotency keys en Resend
**Archivo:** `src/app/api/emails/welcome/route.ts:38`
Se usa `idempotencyKey: "welcome-email/${user.id}"` para evitar duplicados en la API de Resend. Buen patrón para endpoints transaccionales.

### 3. Fire-and-forget pattern para welcome email
**Archivo:** `src/app/auth/callback/route.ts:15`
El welcome email se dispara con `fetch().catch(() => {})` sin bloquear el redirect. El callback de auth no debe fallar por un error de email.

### 4. SECURITY DEFINER con search_path explícito
**Archivo:** `supabase/migrations/2026-07-16-auth-rls-hardening.sql:16`
`security definer set search_path = ''` — evita path injection attacks. Buen patrón de seguridad.

### 5. REVOKE + GRANT granular en lockdown SQL
**Archivo:** `supabase/security/2026-07-15-lockdown.sql`
Uso de `revoke all on all tables/functions from anon` con grants específicos a authenticated. Principio de mínimo privilegio.

### 6. Management API para configuración SMTP
Se usó la Management API de Supabase en lugar del Dashboard, permitiendo automatización y repetibilidad.

### 7. RLS policies scoped a user_id
**Archivo:** `supabase/migrations/2026-07-16-auth-rls-hardening.sql`
Todas las policies usan `(select auth.uid()) = user_id` para aislamiento por usuario.

### 8. Migraciones condicionales con DO blocks
**Archivo:** `supabase/migrations/2026-07-16-auth-rls-hardening.sql:43-106`
Backfill de user_id y ALTER NOT NULL condicional con DO blocks para manejar datos existentes vs nuevos.

## 📝 Contexto Técnico

### SMTP Settings Finales
| Parámetro | Valor |
|-----------|-------|
| Provider | Resend |
| Host | smtp.resend.com |
| Port | 587 |
| Username | `api_key` (NO `resend`) |
| Password | `re_Pv1TWEAb_2wtmkL3hCirSkiz4GW4m956m` |
| Sender | onboarding@resend.dev |
| Rate limit | 30/h (subido de 2/h) |

### Archivos Creados/Modificados
- `src/lib/resend.ts` — Cliente Resend singleton (NUEVO)
- `src/app/api/emails/welcome/route.ts` — Welcome email endpoint (NUEVO)
- `src/app/api/emails/report/route.ts` — Report email con attachment (NUEVO)
- `src/app/auth/callback/route.ts` — Dispara welcome email post-confirmación (MODIFICADO)
- `.env.example` — Añadidas vars RESEND_API_KEY, RESEND_FROM_EMAIL (MODIFICADO)
- `docs/superpowers/specs/2026-07-22-resend-email-integration-design.md` (NUEVO)
- `docs/superpowers/plans/2026-07-22-resend-email-integration.md` (NUEVO)
- `opencode.json` — Añadido Resend MCP server (MODIFICADO)

### Supabase Configuraciones Cambiadas
- Custom SMTP habilitado via Management API PATCH `/v1/projects/skkyxecpcoeapectkvtr/config/auth`
- Rate limit de emails: 2/h → 30/h
- RLS habilitado en `profiles` y `_migrations`
- REVOKE EXECUTE de `handle_new_user()` de PUBLIC/anon/authenticated
- Site URL: `https://ai-financials-for-cpa-web.vercel.app`
- URI allow list incluye `/auth/callback`

### Comandos Relevantes
```bash
# Probar envío de email
curl -X POST https://your-domain.com/api/emails/welcome

# Verificar estado SMTP en Supabase
curl -s https://api.supabase.com/v1/projects/skkyxecpcoeapectkvtr/config/auth \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY"

# Enviar reporte por email
curl -X POST https://your-domain.com/api/emails/report \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipientEmail":"client@example.com","reportType":"workbook","workspaceId":"...","includeTransactions":false}'
```

### Próximos Pasos
1. ⚠️ Rotar SUPABASE_SECRET_KEY (service role key expuesta)
2. Verificar dominio propio en Resend para eliminar restricción de destinatarios
3. Actualizar `smtp_admin_email` y `RESEND_FROM_EMAIL` al dominio verificado
4. Agregar tracking de welcome email en `profiles.welcome_email_sent` para atomicidad
5. Rate limiting en API routes de email
6. Error handler global en API routes

## 🔗 Enlaces Relacionados
- [[Errores Conocidos]]
- [[Deuda Técnica]]
- [[Decisiones Técnicas]]
