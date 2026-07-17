-- Lock down direct client access to application tables and storage.
-- Run this in the Supabase SQL editor against the project database.

begin;

revoke all on schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table if exists public.companies enable row level security;
alter table if exists public.workspaces enable row level security;
alter table if exists public.bank_accounts enable row level security;
alter table if exists public.uploaded_statements enable row level security;
alter table if exists public.transactions enable row level security;
alter table if exists public.classifications enable row level security;
alter table if exists public.classification_rules enable row level security;
alter table if exists public.review_events enable row level security;
alter table if exists public.report_exports enable row level security;
alter table if exists public.opening_balance_entries enable row level security;

drop policy if exists "Authenticated users can manage companies" on public.companies;
create policy "Authenticated users can manage companies"
on public.companies
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage workspaces" on public.workspaces;
create policy "Authenticated users can manage workspaces"
on public.workspaces
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage bank accounts" on public.bank_accounts;
create policy "Authenticated users can manage bank accounts"
on public.bank_accounts
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage uploaded statements" on public.uploaded_statements;
create policy "Authenticated users can manage uploaded statements"
on public.uploaded_statements
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage transactions" on public.transactions;
create policy "Authenticated users can manage transactions"
on public.transactions
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage classifications" on public.classifications;
create policy "Authenticated users can manage classifications"
on public.classifications
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage classification rules" on public.classification_rules;
create policy "Authenticated users can manage classification rules"
on public.classification_rules
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage review events" on public.review_events;
create policy "Authenticated users can manage review events"
on public.review_events
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage report exports" on public.report_exports;
create policy "Authenticated users can manage report exports"
on public.report_exports
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage opening balance entries" on public.opening_balance_entries;
create policy "Authenticated users can manage opening balance entries"
on public.opening_balance_entries
for all
to authenticated
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('private-financial-documents', 'private-financial-documents', false)
on conflict (id) do update
set public = excluded.public;

-- Keep storage private until user-aware policies are ready.
drop policy if exists "Authenticated users can view private financial documents" on storage.objects;
drop policy if exists "Authenticated users can upload private financial documents" on storage.objects;
drop policy if exists "Authenticated users can update private financial documents" on storage.objects;
drop policy if exists "Authenticated users can delete private financial documents" on storage.objects;

create policy "Authenticated users can view private financial documents"
on storage.objects
for select
to authenticated
using (bucket_id = 'private-financial-documents');

create policy "Authenticated users can upload private financial documents"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'private-financial-documents');

create policy "Authenticated users can update private financial documents"
on storage.objects
for update
to authenticated
using (bucket_id = 'private-financial-documents')
with check (bucket_id = 'private-financial-documents');

create policy "Authenticated users can delete private financial documents"
on storage.objects
for delete
to authenticated
using (bucket_id = 'private-financial-documents');

commit;
