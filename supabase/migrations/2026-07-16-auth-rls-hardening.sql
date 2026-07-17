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
  has_orphans boolean;
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
  else
    -- Check if there are orphaned records needing a user
    select exists (
      select 1 from public.companies where user_id is null
    ) into has_orphans;
    if has_orphans then
      raise warning 'No auth users exist. Orphaned records remain with NULL user_id. Create a user via the app, then run: UPDATE public.companies SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL; (repeat for other tables)';
    end if;
  end if;
end;
$$;

-- Set NOT NULL only if all rows have user_id (skip if orphans remain)
do $$
begin
  if not exists (select 1 from public.companies where user_id is null) then
    alter table public.companies alter column user_id set not null;
  end if;
  if not exists (select 1 from public.workspaces where user_id is null) then
    alter table public.workspaces alter column user_id set not null;
  end if;
  if not exists (select 1 from public.bank_accounts where user_id is null) then
    alter table public.bank_accounts alter column user_id set not null;
  end if;
  if not exists (select 1 from public.uploaded_statements where user_id is null) then
    alter table public.uploaded_statements alter column user_id set not null;
  end if;
  if not exists (select 1 from public.transactions where user_id is null) then
    alter table public.transactions alter column user_id set not null;
  end if;
  if not exists (select 1 from public.classifications where user_id is null) then
    alter table public.classifications alter column user_id set not null;
  end if;
  if not exists (select 1 from public.classification_rules where user_id is null) then
    alter table public.classification_rules alter column user_id set not null;
  end if;
  if not exists (select 1 from public.review_events where user_id is null) then
    alter table public.review_events alter column user_id set not null;
  end if;
  if not exists (select 1 from public.report_exports where user_id is null) then
    alter table public.report_exports alter column user_id set not null;
  end if;
  if not exists (select 1 from public.opening_balance_entries where user_id is null) then
    alter table public.opening_balance_entries alter column user_id set not null;
  end if;
end;
$$;

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

-- Drop old permissive policies if any exist from previous migrations
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
