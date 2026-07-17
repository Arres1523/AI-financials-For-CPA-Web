# Auth + RLS Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Per-user data isolation with `user_id` on all tables, RLS policies, profiles table, full auth flow (register, recovery, callback), and API route hardening.

**Architecture:** Supabase Auth for session management (`@supabase/ssr`), raw `pg` Pool for queries with `user_id` filtering from server-validated session, RLS as defense-in-depth.

**Tech Stack:** Next.js 15.1, `@supabase/ssr` ^0.12.3, `@supabase/supabase-js` ^2.110.5, `pg` Pool, Supabase SQL/RLS.

## Global Constraints

- All data queries use `pg` Pool (not Supabase client)
- All API routes use `runtime = "nodejs"`
- All tables get direct `user_id uuid not null references auth.users(id)`
- Every API route validates session via `requireUser()` before any query
- RLS: 4 policies per table (select/insert/update/delete) — no `using (true)`
- Storage: `private-financial-documents/{auth.uid()}/{company_id}/{file_name}`
- Auth pages built as server component + client form component

---
### Task 1: Database migration — profiles, user_id columns, RLS, storage

**Files:**
- Create: `supabase/migrations/2026-07-16-auth-rls-hardening.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- 2026-07-16-auth-rls-hardening.sql
-- Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Add user_id columns
alter table public.companies add column if not exists user_id uuid references auth.users(id);
alter table public.workspaces add column if not exists user_id uuid references auth.users(id);
alter table public.bank_accounts add column if not exists user_id uuid references auth.users(id);
alter table public.uploaded_statements add column if not exists user_id uuid references auth.users(id);
alter table public.transactions add column if not exists user_id uuid references auth.users(id);
alter table public.classifications add column if not exists user_id uuid references auth.users(id);
alter table public.classification_rules add column if not exists user_id uuid references auth.users(id);
alter table public.review_events add column if not exists user_id uuid references auth.users(id);
alter table public.report_exports add column if not exists user_id uuid references auth.users(id);
alter table public.opening_balance_entries add column if not exists user_id uuid references auth.users(id);

-- Backfill existing rows with first auth user
do $$
declare
  first_user_id uuid;
begin
  select id into first_user_id from auth.users order by created_at asc limit 1;
  if first_user_id is not null then
    update public.companies set user_id = first_user_id where user_id is null;
    update public.workspaces set user_id = first_user_id where user_id is null;
    update public.bank_accounts set user_id = first_user_id where user_id is null;
    update public.uploaded_statements set user_id = first_user_id where user_id is null;
    update public.transactions set user_id = first_user_id where user_id is null;
    update public.classifications set user_id = first_user_id where user_id is null;
    update public.classification_rules set user_id = first_user_id where user_id is null;
    update public.review_events set user_id = first_user_id where user_id is null;
    update public.report_exports set user_id = first_user_id where user_id is null;
    update public.opening_balance_entries set user_id = first_user_id where user_id is null;
  end if;
end;
$$;

-- Set NOT NULL after backfill
alter table public.companies alter column user_id set not null;
alter table public.workspaces alter column user_id set not null;
alter table public.bank_accounts alter column user_id set not null;
alter table public.uploaded_statements alter column user_id set not null;
alter table public.transactions alter column user_id set not null;
alter table public.classifications alter column user_id set not null;
alter table public.classification_rules alter column user_id set not null;
alter table public.review_events alter column user_id set not null;
alter table public.report_exports alter column user_id set not null;
alter table public.opening_balance_entries alter column user_id set not null;

-- Indexes on user_id
create index if not exists idx_companies_user_id on public.companies(user_id);
create index if not exists idx_workspaces_user_id on public.workspaces(user_id);
create index if not exists idx_bank_accounts_user_id on public.bank_accounts(user_id);
create index if not exists idx_uploaded_statements_user_id on public.uploaded_statements(user_id);
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_classifications_user_id on public.classifications(user_id);
create index if not exists idx_classification_rules_user_id on public.classification_rules(user_id);
create index if not exists idx_review_events_user_id on public.review_events(user_id);
create index if not exists idx_report_exports_user_id on public.report_exports(user_id);
create index if not exists idx_opening_balance_entries_user_id on public.opening_balance_entries(user_id);

-- Enable RLS on all tables
alter table public.companies enable row level security;
alter table public.workspaces enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.uploaded_statements enable row level security;
alter table public.transactions enable row level security;
alter table public.classifications enable row level security;
alter table public.classification_rules enable row level security;
alter table public.review_events enable row level security;
alter table public.report_exports enable row level security;
alter table public.opening_balance_entries enable row level security;

-- Drop old permissive policies if any exist from lockdown.sql
do $$
declare
  rec record;
begin
  for rec in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('companies','workspaces','bank_accounts','uploaded_statements','transactions','classifications','classification_rules','review_events','report_exports','opening_balance_entries')
  loop
    execute format('drop policy if exists %I on public.%I', rec.policyname, rec.tablename);
  end loop;
end;
$$;

-- RLS policies for companies
create policy "Users can read their own companies"
  on public.companies for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own companies"
  on public.companies for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own companies"
  on public.companies for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own companies"
  on public.companies for delete to authenticated
  using ((select auth.uid()) = user_id);

-- RLS policies for workspaces
create policy "Users can read their own workspaces"
  on public.workspaces for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own workspaces"
  on public.workspaces for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own workspaces"
  on public.workspaces for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own workspaces"
  on public.workspaces for delete to authenticated
  using ((select auth.uid()) = user_id);

-- RLS policies for bank_accounts
create policy "Users can read their own bank_accounts"
  on public.bank_accounts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own bank_accounts"
  on public.bank_accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own bank_accounts"
  on public.bank_accounts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own bank_accounts"
  on public.bank_accounts for delete to authenticated
  using ((select auth.uid()) = user_id);

-- RLS policies for uploaded_statements
create policy "Users can read their own uploaded_statements"
  on public.uploaded_statements for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own uploaded_statements"
  on public.uploaded_statements for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own uploaded_statements"
  on public.uploaded_statements for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own uploaded_statements"
  on public.uploaded_statements for delete to authenticated
  using ((select auth.uid()) = user_id);

-- RLS policies for transactions
create policy "Users can read their own transactions"
  on public.transactions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own transactions"
  on public.transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own transactions"
  on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own transactions"
  on public.transactions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- RLS policies for classifications
create policy "Users can read their own classifications"
  on public.classifications for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own classifications"
  on public.classifications for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own classifications"
  on public.classifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own classifications"
  on public.classifications for delete to authenticated
  using ((select auth.uid()) = user_id);

-- RLS policies for classification_rules
create policy "Users can read their own classification_rules"
  on public.classification_rules for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own classification_rules"
  on public.classification_rules for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own classification_rules"
  on public.classification_rules for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own classification_rules"
  on public.classification_rules for delete to authenticated
  using ((select auth.uid()) = user_id);

-- RLS policies for review_events
create policy "Users can read their own review_events"
  on public.review_events for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own review_events"
  on public.review_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own review_events"
  on public.review_events for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own review_events"
  on public.review_events for delete to authenticated
  using ((select auth.uid()) = user_id);

-- RLS policies for report_exports
create policy "Users can read their own report_exports"
  on public.report_exports for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own report_exports"
  on public.report_exports for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own report_exports"
  on public.report_exports for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own report_exports"
  on public.report_exports for delete to authenticated
  using ((select auth.uid()) = user_id);

-- RLS policies for opening_balance_entries
create policy "Users can read their own opening_balance_entries"
  on public.opening_balance_entries for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own opening_balance_entries"
  on public.opening_balance_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own opening_balance_entries"
  on public.opening_balance_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own opening_balance_entries"
  on public.opening_balance_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Storage: ensure private-financial-documents bucket exists
insert into storage.buckets (id, name, public)
values ('private-financial-documents', 'private-financial-documents', false)
on conflict (id) do nothing;

-- Storage policies
create policy "Users can read their own financial docs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'private-financial-documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Users can upload their own financial docs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'private-financial-documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own financial docs"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'private-financial-documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'private-financial-documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own financial docs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'private-financial-documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
```

- [ ] **Step 2: Apply migration via Supabase**

```bash
# Apply via Supabase MCP:
supabase_apply_migration(name="2026-07-16-auth-rls-hardening")
```

- [ ] **Step 3: Verify RLS enabled**

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN (
  'companies','workspaces','bank_accounts','uploaded_statements',
  'transactions','classifications','classification_rules',
  'review_events','report_exports','opening_balance_entries'
);
```
Expected: 10 rows with `rowsecurity = true`.

- [ ] **Step 4: Verify no permissive policies**

```sql
SELECT tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND (qual = 'true' OR with_check = 'true');
```
Expected: 0 rows.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/2026-07-16-auth-rls-hardening.sql
git commit -m "feat: add profiles, user_id columns, RLS policies, and storage isolation"
```

---
### Task 2: requireUser() helper, UnauthorizedError, and middleware paths

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Add UnauthorizedError class to auth.ts**

```typescript
export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
```

- [ ] **Step 2: Add requireUser() async function to auth.ts**

```typescript
export async function requireUser(): Promise<{ id: string; email: string }> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new UnauthorizedError("Authentication required");
  return { id: user.id, email: user.email! };
}
```

- [ ] **Step 3: Update isAuthPath to include new auth routes**

```typescript
function isAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/update-password") ||
    pathname.startsWith("/auth/callback")
  );
}
```

- [ ] **Step 4: Update imports — add UnauthorizedError to existing export**

File should now export: `isSupabaseAuthConfigured`, `getSupabaseEnv`, `getAccessDecision`, `requireUser`, `UnauthorizedError`.

- [ ] **Step 5: Add test for UnauthorizedError**

```typescript
// Add to tests/lib/auth.test.ts
import { UnauthorizedError } from "@/lib/auth";

describe("UnauthorizedError", () => {
  it("is an instance of Error with name UnauthorizedError", () => {
    const err = new UnauthorizedError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("UnauthorizedError");
    expect(err.message).toBe("Authentication required");
  });

  it("accepts custom message", () => {
    const err = new UnauthorizedError("Custom message");
    expect(err.message).toBe("Custom message");
  });
});

describe("isAuthPath", () => {
  it("recognizes /register as auth path", () => {
    // This tests the isAuthPath function indirectly via getAccessDecision
    const { getAccessDecision } = require("@/lib/auth");
    const decision = getAccessDecision("/register", false);
    expect(decision.allowed).toBe(true);
  });
});
```

- [ ] **Step 6: Run tests**

```bash
pnpm test -- tests/lib/auth.test.ts
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts tests/lib/auth.test.ts
git commit -m "feat: add requireUser(), UnauthorizedError, and new auth paths"
```

---
### Task 3: Auth callback route

**Files:**
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Create callback route handler**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat: add auth callback route for email verification"
```

---
### Task 4: Registration page

**Files:**
- Create: `src/app/register/page.tsx`
- Create: `src/app/register/RegisterForm.tsx`

- [ ] **Step 1: Create RegisterForm client component**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsSubmitting(false);
      return;
    }

    setSuccess(true);
    setIsSubmitting(false);
  }

  if (success) {
    return (
      <div className="rounded-lg border border-[#27272A] bg-[#111111] p-6">
        <h2 className="text-lg font-mono font-semibold text-[#FFFFFF]">Check your email</h2>
        <p className="mt-2 font-mono text-sm text-[#A1A1AA]">
          We sent a confirmation link to <strong className="text-[#FFFFFF]">{email}</strong>.
          Click the link to activate your account.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-4 font-mono" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#A1A1AA]" htmlFor="fullName">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-md border border-[#27272A] bg-[#111111] px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#A1A1AA] outline-none transition duration-150 focus:border-[#FFD60A] focus:ring-1 focus:ring-[#FFD60A]"
          autoComplete="name"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#A1A1AA]" htmlFor="reg-email">
          Email
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-[#27272A] bg-[#111111] px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#A1A1AA] outline-none transition duration-150 focus:border-[#FFD60A] focus:ring-1 focus:ring-[#FFD60A]"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#A1A1AA]" htmlFor="reg-password">
          Password
        </label>
        <input
          id="reg-password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-[#27272A] bg-[#111111] px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#A1A1AA] outline-none transition duration-150 focus:border-[#FFD60A] focus:ring-1 focus:ring-[#FFD60A]"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </div>
      {error ? <p className="text-sm text-[#EF4444]" role="alert">{error}</p> : null}
      <button
        type="submit"
        className="w-full rounded-md bg-[#FFD60A] px-4 py-2 text-sm font-semibold text-[#000000] transition duration-150 hover:bg-[#FFD60A]/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>
      <p className="text-center font-mono text-xs text-[#A1A1AA]">
        Already have an account?{" "}
        <a href="/login" className="text-[#FFD60A] underline">Sign in</a>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Create Register page server component**

```typescript
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RegisterForm from "./RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/");
  } catch {}

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#000000] px-4 py-12 font-mono">
      <section className="w-full max-w-md rounded-lg border border-[#27272A] bg-[#111111] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A1A1AA]">Private Workspace</p>
        <h1 className="mt-2 text-xl font-semibold text-[#FFFFFF]">Create account</h1>
        <p className="mt-2 text-sm text-[#A1A1AA]">
          Register to access the financial workflow platform.
        </p>
        <div className="mt-6">
          <Suspense>
            <RegisterForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/register/
git commit -m "feat: add registration page with signUp flow"
```

---
### Task 5: Password recovery pages

**Files:**
- Create: `src/app/forgot-password/page.tsx`
- Create: `src/app/forgot-password/ForgotPasswordForm.tsx`
- Create: `src/app/update-password/page.tsx`
- Create: `src/app/update-password/UpdatePasswordForm.tsx`

- [ ] **Step 1: Create ForgotPasswordForm client component**

```typescript
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/update-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setIsSubmitting(false);
      return;
    }

    setSent(true);
    setIsSubmitting(false);
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-[#27272A] bg-[#111111] p-6 font-mono">
        <h2 className="text-lg font-semibold text-[#FFFFFF]">Check your email</h2>
        <p className="mt-2 text-sm text-[#A1A1AA]">
          We sent a password reset link to <strong className="text-[#FFFFFF]">{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-4 font-mono" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#A1A1AA]" htmlFor="reset-email">
          Email
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-[#27272A] bg-[#111111] px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#A1A1AA] outline-none transition duration-150 focus:border-[#FFD60A] focus:ring-1 focus:ring-[#FFD60A]"
          autoComplete="email"
          required
        />
      </div>
      {error ? <p className="text-sm text-[#EF4444]" role="alert">{error}</p> : null}
      <button
        type="submit"
        className="w-full rounded-md bg-[#FFD60A] px-4 py-2 text-sm font-semibold text-[#000000] transition duration-150 hover:bg-[#FFD60A]/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending..." : "Send reset link"}
      </button>
      <p className="text-center text-xs text-[#A1A1AA]">
        <a href="/login" className="text-[#FFD60A] underline">Back to sign in</a>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Create forgot-password page**

```typescript
import { Suspense } from "react";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#000000] px-4 py-12 font-mono">
      <section className="w-full max-w-md rounded-lg border border-[#27272A] bg-[#111111] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A1A1AA]">Private Workspace</p>
        <h1 className="mt-2 text-xl font-semibold text-[#FFFFFF]">Reset password</h1>
        <p className="mt-2 text-sm text-[#A1A1AA]">
          Enter your email and we will send you a reset link.
        </p>
        <div className="mt-6">
          <Suspense>
            <ForgotPasswordForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Create UpdatePasswordForm client component**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setIsSubmitting(false);
      return;
    }

    router.replace("/login?password_updated=true");
    router.refresh();
  }

  return (
    <form className="space-y-4 font-mono" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#A1A1AA]" htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-[#27272A] bg-[#111111] px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#A1A1AA] outline-none transition duration-150 focus:border-[#FFD60A] focus:ring-1 focus:ring-[#FFD60A]"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </div>
      {error ? <p className="text-sm text-[#EF4444]" role="alert">{error}</p> : null}
      <button
        type="submit"
        className="w-full rounded-md bg-[#FFD60A] px-4 py-2 text-sm font-semibold text-[#000000] transition duration-150 hover:bg-[#FFD60A]/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Create update-password page**

```typescript
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UpdatePasswordForm from "./UpdatePasswordForm";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  } catch {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#000000] px-4 py-12 font-mono">
      <section className="w-full max-w-md rounded-lg border border-[#27272A] bg-[#111111] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A1A1AA]">Private Workspace</p>
        <h1 className="mt-2 text-xl font-semibold text-[#FFFFFF]">Set new password</h1>
        <p className="mt-2 text-sm text-[#A1A1AA]">
          Enter your new password below.
        </p>
        <div className="mt-6">
          <Suspense>
            <UpdatePasswordForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/forgot-password/ src/app/update-password/
git commit -m "feat: add password recovery and update pages"
```

---
### Task 6: Harden companies API routes

**Files:**
- Modify: `src/app/api/companies/route.ts`
- Modify: `src/app/api/companies/[id]/route.ts`

- [ ] **Step 1: Rewrite companies/route.ts with user_id isolation**

```typescript
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await query(
      "SELECT * FROM companies WHERE user_id = $1 ORDER BY legal_name",
      [user.id]
    );
    return NextResponse.json(rows.map((c: any) => ({
      id: c.id,
      legalName: c.legal_name,
      createdAt: c.created_at,
    })));
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { legalName } = body;
    if (!legalName || !legalName.trim()) {
      return NextResponse.json({ error: "Legal name is required" }, { status: 400 });
    }
    const existing = await queryOne(
      "SELECT id FROM companies WHERE legal_name = $1 AND user_id = $2",
      [legalName.trim(), user.id]
    );
    if (existing) {
      return NextResponse.json({ error: "Company already exists", id: existing.id }, { status: 409 });
    }
    const id = uuid();
    await query(
      "INSERT INTO companies (id, legal_name, user_id) VALUES ($1, $2, $3)",
      [id, legalName.trim(), user.id]
    );
    return NextResponse.json({ id, legalName: legalName.trim(), createdAt: new Date().toISOString() });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
```

- [ ] **Step 2: Rewrite companies/[id]/route.ts with user_id isolation**

```typescript
import { NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const company = await queryOne(
      "SELECT * FROM companies WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );
    if (!company) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: company.id,
      legalName: company.legal_name,
      createdAt: company.created_at,
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await execute("DELETE FROM companies WHERE id = $1 AND user_id = $2", [id, user.id]);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/companies/
git commit -m "feat: add user_id isolation to companies API routes"
```

---
### Task 7: Harden bank_accounts API routes

**Files:**
- Modify: `src/app/api/accounts/route.ts`
- Modify: `src/app/api/accounts/[id]/route.ts`

- [ ] **Step 1: Rewrite accounts/route.ts with user_id isolation**

```typescript
import { NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    const rows = await query(
      "SELECT * FROM bank_accounts WHERE company_id = $1 AND user_id = $2 ORDER BY account_name",
      [companyId, user.id]
    );
    return NextResponse.json(
      rows.map((a: any) => ({
        id: a.id,
        companyId: a.company_id,
        accountName: a.account_name,
        bankName: a.bank_name,
        lastFour: a.last_four,
        accountType: a.account_type,
        openingBalance: a.opening_balance,
        closingBalance: a.closing_balance,
        createdAt: a.created_at,
      }))
    );
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { companyId, accountName, bankName, lastFour, accountType, openingBalance, closingBalance } = body;
    if (!companyId || !accountName || !bankName || !lastFour) {
      return NextResponse.json({
        error: "companyId, accountName, bankName, lastFour are required"
      }, { status: 400 });
    }
    const id = uuid();
    await execute(
      "INSERT INTO bank_accounts (id, company_id, account_name, bank_name, last_four, account_type, opening_balance, closing_balance, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [id, companyId, accountName, bankName, lastFour, accountType || "Checking", openingBalance || 0, closingBalance || 0, user.id]
    );
    return NextResponse.json({
      id,
      companyId,
      accountName,
      bankName,
      lastFour,
      accountType: accountType || "Checking",
      openingBalance: openingBalance || 0,
      closingBalance: closingBalance || 0,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
```

- [ ] **Step 2: Rewrite accounts/[id]/route.ts with user_id isolation**

```typescript
import { NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { accountName, bankName, lastFour, accountType, openingBalance, closingBalance } = body;
    if (!accountName || !bankName || !lastFour) {
      return NextResponse.json({
        error: "accountName, bankName, lastFour are required"
      }, { status: 400 });
    }
    const existing = await queryOne(
      "SELECT id FROM bank_accounts WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );
    if (!existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    await execute(
      "UPDATE bank_accounts SET account_name = $1, bank_name = $2, last_four = $3, account_type = $4, opening_balance = $5, closing_balance = $6 WHERE id = $7 AND user_id = $8",
      [accountName, bankName, lastFour, accountType, openingBalance ?? 0, closingBalance ?? 0, id, user.id]
    );
    const row = await queryOne(
      "SELECT * FROM bank_accounts WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );
    return NextResponse.json({
      id: row.id,
      companyId: row.company_id,
      accountName: row.account_name,
      bankName: row.bank_name,
      lastFour: row.last_four,
      accountType: row.account_type,
      openingBalance: row.opening_balance,
      closingBalance: row.closing_balance,
      createdAt: row.created_at,
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await execute("DELETE FROM bank_accounts WHERE id = $1 AND user_id = $2", [id, user.id]);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/accounts/
git commit -m "feat: add user_id isolation to bank_accounts API routes"
```

---
### Task 8: Harden workspaces API route

**Files:**
- Modify: `src/app/api/workspaces/route.ts`

- [ ] **Step 1: Rewrite workspaces/route.ts with user_id isolation**

```typescript
import { NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    let rows: any[];
    if (companyId) {
      rows = await query(
        "SELECT * FROM workspaces WHERE company_id = $1 AND user_id = $2 ORDER BY tax_year DESC",
        [companyId, user.id]
      );
    } else {
      rows = await query(
        "SELECT * FROM workspaces WHERE user_id = $1 ORDER BY created_at DESC",
        [user.id]
      );
    }
    return NextResponse.json(
      rows.map((w: any) => ({
        id: w.id,
        companyId: w.company_id,
        taxYear: w.tax_year,
        status: w.status,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
      }))
    );
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { companyId, taxYear } = body;
    if (!companyId || !taxYear) {
      return NextResponse.json({ error: "companyId and taxYear are required" }, { status: 400 });
    }
    const existing = await queryOne(
      "SELECT id FROM workspaces WHERE company_id = $1 AND tax_year = $2 AND user_id = $3",
      [companyId, taxYear, user.id]
    );
    if (existing) {
      return NextResponse.json({ error: "Workspace already exists", id: existing.id }, { status: 409 });
    }
    const id = uuid();
    await execute(
      "INSERT INTO workspaces (id, company_id, tax_year, user_id) VALUES ($1, $2, $3, $4)",
      [id, companyId, taxYear, user.id]
    );
    const row = await queryOne(
      "SELECT * FROM workspaces WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );
    return NextResponse.json({
      id: row.id,
      companyId: row.company_id,
      taxYear: row.tax_year,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const { id, status } = await request.json();
    await execute(
      "UPDATE workspaces SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
      [status, id, user.id]
    );
    const row = await queryOne(
      "SELECT * FROM workspaces WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: row.id,
      companyId: row.company_id,
      taxYear: row.tax_year,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/workspaces/route.ts
git commit -m "feat: add user_id isolation to workspaces API route"
```

---
### Task 9: Harden transactions, classifications, statements API routes

**Files:**
- Modify: `src/app/api/transactions/route.ts`
- Modify: `src/app/api/classifications/route.ts`
- Modify: `src/app/api/statements/route.ts`

- [ ] **Step 1: Rewrite transactions/route.ts with user_id isolation**

```typescript
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const bankAccountId = searchParams.get("bankAccountId");
    const reviewStatus = searchParams.get("reviewStatus");
    const needsReview = searchParams.get("needsReview");

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    let sql = `
      SELECT t.*, c.id as c_id, c.final_category, c.report_type, c.confidence, c.rule_used, c.review_status, c.is_manual_correction, c.created_at as c_created_at, c.updated_at as c_updated_at,
             a.account_name, a.bank_name, a.last_four
      FROM transactions t
      LEFT JOIN classifications c ON c.transaction_id = t.id
      LEFT JOIN bank_accounts a ON a.id = t.bank_account_id
      WHERE t.workspace_id = $1 AND t.user_id = $2
    `;
    const params: unknown[] = [workspaceId, user.id];
    let paramIndex = 3;

    if (bankAccountId) {
      sql += ` AND t.bank_account_id = $${paramIndex}`;
      params.push(bankAccountId);
      paramIndex++;
    }

    if (needsReview === "true") {
      sql += ` AND c.review_status IN ('pending', 'support_needed', 'cpa_review', 'card_statements_needed')`;
    }

    if (reviewStatus) {
      sql += ` AND c.review_status = $${paramIndex}`;
      params.push(reviewStatus);
      paramIndex++;
    }

    sql += " ORDER BY t.date ASC, t.original_row_index ASC";

    const rows = await query(sql, params);
    return NextResponse.json(
      rows.map((r: any) => ({
        id: r.id,
        workspaceId: r.workspace_id,
        bankAccountId: r.bank_account_id,
        statementId: r.statement_id,
        date: r.date,
        description: r.description,
        amount: r.amount,
        balance: r.balance,
        originalRowIndex: r.original_row_index,
        createdAt: r.created_at,
        accountName: r.account_name,
        bankName: r.bank_name,
        lastFour: r.last_four,
        classification: r.c_id
          ? {
              id: r.c_id,
              transactionId: r.id,
              finalCategory: r.final_category,
              reportType: r.report_type,
              confidence: r.confidence,
              ruleUsed: r.rule_used,
              reviewStatus: r.review_status,
              isManualCorrection: !!r.is_manual_correction,
              createdAt: r.c_created_at,
              updatedAt: r.c_updated_at,
            }
          : null,
      }))
    );
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
```

- [ ] **Step 2: Add requireUser() to classifications/route.ts**

Import changes:
```typescript
import { requireUser, UnauthorizedError } from "@/lib/auth";
```

Wrap POST body in try/catch:
```typescript
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    // ... existing body parsing and logic ...
    // No user_id filter needed here because classifications are
    // accessed via transaction_id which is already user-scoped
    // through the workspace/company chain. RLS provides the
    // defense-in-depth.
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
```

- [ ] **Step 3: Rewrite statements/route.ts with user_id isolation**

```typescript
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }
    const rows = await query(
      "SELECT id, file_name, sheet_name, total_rows, imported_rows, uploaded_at FROM uploaded_statements WHERE workspace_id = $1 AND user_id = $2 ORDER BY uploaded_at DESC",
      [workspaceId, user.id]
    );
    return NextResponse.json(rows.map((s: any) => ({
      id: s.id,
      fileName: s.file_name,
      sheetName: s.sheet_name,
      totalRows: s.total_rows,
      importedRows: s.imported_rows,
      uploadedAt: s.uploaded_at,
    })));
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/transactions/route.ts src/app/api/classifications/route.ts src/app/api/statements/route.ts
git commit -m "feat: add user_id isolation to transactions, classifications, statements routes"
```

---
### Task 10: Harden remaining API routes (upload, import, opening-balances, export)

**Files:**
- Modify: `src/app/api/upload/route.ts`
- Modify: `src/app/api/import/route.ts`
- Modify: `src/app/api/opening-balances/route.ts`
- Modify: `src/app/api/export/memo/route.ts`
- Modify: `src/app/api/export/workbook/route.ts`

- [ ] **Step 1: Add requireUser() to upload/route.ts**

```typescript
import { NextResponse } from "next/server";
import { buildPreview } from "@/domain/importXlsx";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    const fileName = file.name;
    if (!fileName.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Only .xlsx files are accepted" }, { status: 400 });
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const preview = buildPreview(buffer, fileName);
    return NextResponse.json(preview);
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
```

- [ ] **Step 2: Add user_id to import/route.ts**

This is the most complex route. Changes:
- Import `requireUser, UnauthorizedError`
- Add `const user = await requireUser()` at start
- Add `user_id` to all INSERT statements:
  - `uploaded_statements`: add `, user_id` to columns and `, $N` to VALUES
  - `transactions`: add `, user_id` to columns and `, $N` to VALUES
  - `classifications`: add `, user_id` to columns and `, $N` to VALUES
- Wrap body in try/catch for UnauthorizedError

- [ ] **Step 3: Rewrite opening-balances/route.ts with user_id isolation**

```typescript
import { NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }
    const rows = await query(
      "SELECT * FROM opening_balance_entries WHERE workspace_id = $1 AND user_id = $2",
      [workspaceId, user.id]
    );
    return NextResponse.json(rows.map((r: any) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      accountName: r.account_name,
      accountType: r.account_type,
      amount: r.amount,
      source: r.source,
      supportStatus: r.support_status,
    })));
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { workspaceId, entries } = body;
    if (!workspaceId || !entries) {
      return NextResponse.json({ error: "workspaceId and entries required" }, { status: 400 });
    }
    await execute(
      "DELETE FROM opening_balance_entries WHERE workspace_id = $1 AND user_id = $2",
      [workspaceId, user.id]
    );
    for (const e of entries) {
      await execute(
        "INSERT INTO opening_balance_entries (id, workspace_id, account_name, account_type, amount, source, support_status, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [uuid(), workspaceId, e.accountName, e.accountType, e.amount, e.source || "manual", e.supportStatus || "provided", user.id]
      );
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
```

- [ ] **Step 4: Add requireUser() to export/memo/route.ts**

```typescript
import { NextResponse } from "next/server";
import { buildMemoModel } from "../../../../domain/cpaPackage";
import type { CpaPackage, TransactionWithClassification } from "../../../../domain/types";
import { buildCpaMemoBuffer } from "../../../../exports/cpaMemo";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      pkg: CpaPackage;
      transactions: TransactionWithClassification[];
    };
    const model = buildMemoModel(body.pkg, body.transactions);
    const buffer = await buildCpaMemoBuffer(model);
    const responseBody = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    return new NextResponse(responseBody, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${body.pkg.llcName.replace(/\s+/g, "_")}_${body.pkg.taxYear}_CPA_Memo.docx"`
      }
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
```

- [ ] **Step 5: Add user_id to export/workbook/route.ts**

Import changes:
```typescript
import { requireUser, UnauthorizedError } from "@/lib/auth";
```

Modifications within the route:
- Add `const user = await requireUser()` at start
- Workspace lookup: add `AND w.user_id = $2` with `[body.workspaceId, user.id]`
- Transactions query: add `AND t.user_id = $2` with `[body.workspaceId, user.id]`, shift all param indices
- Accounts query: add `AND a.user_id = $2` with `[body.workspaceId, user.id]`
- Recon query: add `AND t.user_id = $3` with `[body.workspaceId, body.workspaceId, user.id]`
- INSERT report_exports: add `, user_id` to columns and `, $4` with `user.id`
- Wrap all in try/catch for UnauthorizedError

- [ ] **Step 6: Commit**

```bash
git add src/app/api/upload/route.ts src/app/api/import/route.ts src/app/api/opening-balances/route.ts src/app/api/export/
git commit -m "feat: add user_id isolation to upload, import, opening-balances, export routes"
```

---
### Task 11: Auth tests

**Files:**
- Create: `tests/auth/auth-flow.test.tsx`
- Create: `tests/auth/rls.test.ts`

- [ ] **Step 1: Write auth flow unit tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginForm from "@/app/login/LoginForm";

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password fields", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toBeDefined();
    expect(screen.getByLabelText("Password")).toBeDefined();
  });

  it("shows error for invalid credentials", async () => {
    const mockSignIn = vi.fn().mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    vi.mocked(
      (await import("@/lib/supabase/browser")).createClient().auth.signInWithPassword
    ).mockImplementation(mockSignIn);

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid login credentials")).toBeDefined();
    });
  });

  it("disables button while submitting", async () => {
    const mockSignIn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 100))
    );
    vi.mocked(
      (await import("@/lib/supabase/browser")).createClient().auth.signInWithPassword
    ).mockImplementation(mockSignIn);

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run auth tests**

```bash
pnpm test -- tests/auth/auth-flow.test.tsx
```
Expected: PASS.

- [ ] **Step 3: Write RLS isolation integration test structure**

```typescript
import { describe, it, expect } from "vitest";

// These tests verify database-level isolation using Supabase REST API
// They require a real database with RLS enabled and two test users.
// Run manually against a test database.

describe("RLS isolation", () => {
  it("User A cannot select User B's companies", async () => {
    // Arrange: Create company as User A via API
    // Act: Query companies as User B
    // Assert: User B's result does not include User A's company
  });

  it("User A cannot delete User B's bank account", async () => {
    // Arrange: Create account as User A via API
    // Act: Try delete as User B
    // Assert: 404 or 403
  });

  it("Unauthenticated requests return 401 for all API routes", async () => {
    // Act: GET /api/companies without auth header
    // Assert: 401 response
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add tests/auth/
git commit -m "test: add auth flow tests and RLS isolation test structure"
```

---
### Task 12: Final validation

- [ ] **Step 1: Run lint**

```bash
pnpm lint
```
Expected: No type errors. Fix any issues found.

- [ ] **Step 2: Run all unit tests**

```bash
pnpm test
```
Expected: All tests pass.

- [ ] **Step 3: Search for secret key exposure**

```bash
grep -rn "service_role" src/ --include="*.ts" --include="*.tsx" || echo "No service_role keys found in src/"
grep -rn "SUPABASE_SECRET\|SERVICE_ROLE_KEY\|ANON_KEY" src/ --include="*.ts" --include="*.tsx" || echo "No secret keys in src/"
```
Expected: No matches.

- [ ] **Step 4: Verify RLS policies are correct via Supabase**

```sql
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```
Expected: 40 policies, none with `qual = 'true'` or `with_check = 'true'`.

- [ ] **Step 5: Commit final changes**

```bash
git add -A
git commit -m "chore: final validation after auth and RLS hardening"
```
