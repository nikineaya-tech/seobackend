create extension if not exists pgcrypto;

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('competitors', 'funnel', 'technical', 'keywords')),
  title text not null,
  target_url text,
  query text,
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  price_snapshot jsonb,
  source_job_id uuid,
  is_public boolean not null default false,
  share_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.user_reports
  add column if not exists source_job_id uuid;

create unique index if not exists user_reports_source_job_idx
  on public.user_reports(source_job_id);

create index if not exists user_reports_user_created_idx
  on public.user_reports(user_id, created_at desc);

create index if not exists user_reports_price_history_idx
  on public.user_reports(user_id, target_url, created_at)
  where type = 'funnel' and price_snapshot is not null;

alter table public.user_reports enable row level security;

drop policy if exists "users_read_own_reports" on public.user_reports;
create policy "users_read_own_reports"
  on public.user_reports for select
  using (auth.uid() = user_id or is_public = true);

drop policy if exists "users_insert_own_reports" on public.user_reports;
create policy "users_insert_own_reports"
  on public.user_reports for insert
  with check (auth.uid() = user_id);

drop policy if exists "users_update_own_reports" on public.user_reports;
create policy "users_update_own_reports"
  on public.user_reports for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users_delete_own_reports" on public.user_reports;
create policy "users_delete_own_reports"
  on public.user_reports for delete
  using (auth.uid() = user_id);

create extension if not exists pgcrypto;

create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gemini', 'openrouter', 'groq')),
  encrypted_key text not null,
  key_iv text not null,
  key_tag text not null,
  key_last4 text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists user_api_keys_user_provider_idx
  on public.user_api_keys(user_id, provider);

alter table public.user_api_keys enable row level security;

grant select, insert, update, delete on public.user_api_keys to authenticated;

drop policy if exists "users_read_own_api_keys" on public.user_api_keys;
create policy "users_read_own_api_keys"
  on public.user_api_keys for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users_insert_own_api_keys" on public.user_api_keys;
create policy "users_insert_own_api_keys"
  on public.user_api_keys for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "users_update_own_api_keys" on public.user_api_keys;
create policy "users_update_own_api_keys"
  on public.user_api_keys for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users_delete_own_api_keys" on public.user_api_keys;
create policy "users_delete_own_api_keys"
  on public.user_api_keys for delete
  to authenticated
  using ((select auth.uid()) = user_id);
