# Auth + RLS Hardening Design

**Date**: 2026-07-16
**Status**: Approved
**Priority**: P0 (Security)

## Context

The application has 11 database tables, all with RLS disabled and no user ownership. Any authenticated user can access all data. Auth exists via `@supabase/ssr` but is optional (falls back if env vars missing). This spec implements per-user data isolation using `user_id` on every business entity.

## Architecture Decision: Hybrid Approach

**API routes** use `pg` Pool for database access (not Supabase client). The hybrid approach is:
1. Validate session via `createServerClient().auth.getUser()`
2. Extract `user.id` from the authenticated session
3. Pass `user_id` as parameter in every raw SQL query
4. RLS policies as defense-in-depth (not the primary barrier)

## 1. Profiles Table

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user()
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- Trigger creates profile on signup
- Backfill for existing users
- `raw_user_meta_data` only used for initial `full_name`, never for authorization

## 2. user_id Migration

All business tables receive a direct `user_id` column (not derived via FK joins):

| Table | user_id | Index |
|-------|---------|-------|
| companies | `uuid not null references auth.users(id)` | `idx_companies_user_id` |
| workspaces | same | `idx_workspaces_user_id` |
| bank_accounts | same | `idx_bank_accounts_user_id` |
| uploaded_statements | same | `idx_uploaded_statements_user_id` |
| transactions | same | `idx_transactions_user_id` |
| classifications | same | `idx_classifications_user_id` |
| classification_rules | same | `idx_classification_rules_user_id` |
| review_events | same | `idx_review_events_user_id` |
| report_exports | same | `idx_report_exports_user_id` |
| opening_balance_entries | same | `idx_opening_balance_entries_user_id` |

Backfill: existing records assigned to the current app user.

## 3. RLS Policies

Every table gets 4 policies (select, insert, update, delete) following the pattern:

```sql
alter table public.companies enable row level security;

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
```

Total: ~40 policies across 10 tables.

## 4. Storage

Bucket: `private-financial-documents`
Path structure: `{auth.uid()}/{company_id}/{file_name}`
Policies: validate that the first path segment equals `auth.uid()` for all operations.

## 5. Auth Flow Improvements

| Route | Component | Function |
|-------|-----------|----------|
| `/login` | LoginForm (exists) | signInWithPassword |
| `/register` | RegisterForm (new) | signUp |
| `/forgot-password` | ForgotPasswordForm (new) | resetPasswordForEmail |
| `/update-password` | UpdatePasswordForm (new) | updateUser |
| `/auth/callback` | route handler (new) | exchange code for session |

Middleware updated to recognize new public paths.

## 6. API Route Hardening

Helper: `requireUser()` in `src/lib/auth.ts`

```typescript
export async function requireUser(): Promise<{ id: string; email: string }> {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new UnauthorizedError("Authentication required");
  return { id: user.id, email: user.email! };
}
```

Pattern applied to all 14 API routes. Each route:
1. Calls `requireUser()` at entry
2. Filters all queries with `WHERE user_id = $1`
3. Returns 401 on auth failure, 404 on not found, 422 on validation, 500 on server error

## 7. Testing

| Test file | Type | Coverage |
|-----------|------|----------|
| `tests/auth/rls.test.ts` | Integration | User isolation: A cannot read/write B's data |
| `tests/auth/api-routes.test.ts` | Integration | 401 for unauthenticated requests |
| `tests/auth/auth-flow.test.tsx` | Unit | Login, logout, form validation, error messages |
| `tests/middleware.test.ts` | Unit | Redirect logic for all public/private paths |

Manual verification: 2 users in separate browser sessions.

## 8. Validation Checklist

- [ ] Unit tests pass
- [ ] Lint passes (`pnpm lint`)
- [ ] Build passes (`pnpm build` if applicable)
- [ ] E2E auth tests pass
- [ ] Manual test: User A cannot see User B's data
- [ ] Supabase security advisor: no `using (true)` policies
- [ ] No secret keys exposed in `NEXT_PUBLIC_*`
- [ ] All 40+ RLS policies deployed
- [ ] Storage bucket access isolated per user
