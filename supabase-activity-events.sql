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
-- Daka admin authentication tables
-- Safe to run once in Supabase SQL editor.
-- Passwords are never stored in clear text. The backend writes scrypt hashes into password_hash.
create table if not exists public.daka_admin_users (
  email text primary key,
  password_hash text not null,
  is_active boolean not null default true,
  failed_login_count integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daka_admin_sessions (
  token_hash text primary key,
  email text not null references public.daka_admin_users(email) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists daka_admin_sessions_email_idx on public.daka_admin_sessions (email);
create index if not exists daka_admin_sessions_expires_at_idx on public.daka_admin_sessions (expires_at);

alter table public.daka_admin_users enable row level security;
alter table public.daka_admin_sessions enable row level security;

-- No anon/authenticated policies are created on purpose.
-- Access must go through the Render backend with SUPABASE_SERVICE_KEY only.
