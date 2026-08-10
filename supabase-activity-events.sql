-- Daka first-party activity tracking for admin.html
-- Safe to run once in Supabase SQL editor.
create table if not exists public.site_activity_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  page_path text,
  domain text,
  title text,
  label text,
  user_id uuid,
  email text,
  ip_hash text,
  user_agent text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists site_activity_events_created_at_idx on public.site_activity_events (created_at desc);
create index if not exists site_activity_events_event_type_idx on public.site_activity_events (event_type);
create index if not exists site_activity_events_user_id_idx on public.site_activity_events (user_id);

alter table public.site_activity_events enable row level security;

-- Service role writes/reads through backend only. No public client access policy is created.
