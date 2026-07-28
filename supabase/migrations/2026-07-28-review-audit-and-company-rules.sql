alter table public.review_events drop constraint if exists review_events_action_check;
alter table public.review_events add constraint review_events_action_check
  check(action in ('approve','reject','exclude','change_category','mark_support_needed','mark_cpa_review','correct_transaction'));
alter table public.review_events add column if not exists previous_status text;
alter table public.review_events add column if not exists new_status text;
alter table public.review_events add column if not exists correction_json text;

alter table public.classification_rules add column if not exists direction text default 'any';
alter table public.classification_rules add column if not exists review_status text default 'pending';
alter table public.classification_rules add column if not exists confidence text default 'medium';
alter table public.classification_rules add column if not exists updated_at timestamp default now();
create index if not exists idx_classification_rules_company_priority on public.classification_rules(company_id, priority desc);
