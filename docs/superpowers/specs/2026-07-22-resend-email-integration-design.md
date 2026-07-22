# Resend Email Integration

## Overview

Add email capabilities to the CPA financial application using Resend. Two features: welcome emails on signup and report delivery by email.

## Setup

- Install `resend` npm package
- Add `RESEND_API_KEY` to `.env.local` (and `.env.example`)
- Create `src/lib/resend.ts` — single shared Resend client
- Verify a domain in Resend dashboard

## Welcome Email

**Trigger:** When a user completes email confirmation and lands on the auth callback (`/auth/callback/route.ts`), send a welcome email. The callback already exchanges the code for a session and redirects to `/`. Before redirecting, fire a `fetch` (fire-and-forget) to a new API route.

**New route:** `POST /api/emails/welcome`
- Receives `{ email, fullName }` in the body
- Calls `requireUser()` to ensure authenticity
- Sends a welcome email via Resend (HTML template with the user's name)
- Returns `{ sent: true }`

**Tracking:** Before sending, check `user_metadata.welcome_sent` from the authenticated user session. If not set, send the email and update metadata via `supabase.auth.updateUser({ data: { welcome_sent: true } })`. This prevents duplicate sends without requiring the service_role key.

## Report Email

**New route:** `POST /api/emails/report`
- Authenticated
- Accepts `{ workspaceId, reportType: "workbook" | "memo", recipientEmail, includeTransactions? }`
- Generates the report buffer using existing `buildWorkbookBuffer` / `buildCpaMemoBuffer`
- Sends via Resend with the file as an attachment (max 40MB)
- Logs the send in a new `email_logs` table (optional — for audit trail)

**Reuses** the existing export pipeline — no duplication of report generation logic.

## Files Changed

| File | Action |
|------|--------|
| `.env.example` | Add `RESEND_API_KEY` |
| `src/lib/resend.ts` | **New** — Resend client singleton |
| `src/app/api/emails/welcome/route.ts` | **New** — welcome email endpoint |
| `src/app/api/emails/report/route.ts` | **New** — report email endpoint |
| `src/app/auth/callback/route.ts` | Edit — fire welcome email after session exchange |
| `package.json` | Add `resend` dependency |

## Non-Goals

- Not replacing Supabase Auth's built-in confirmation/password-reset emails
- Not building an email template system — templates are hardcoded
- Not adding a full email queue or retry system — fire-and-forget with basic error logging
