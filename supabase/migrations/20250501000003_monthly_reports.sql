-- Monthly Reports: company-wide metrics, one row per month
-- (client_id retained for legacy compat; no longer FK'd, will be removed in Phase 2)
create table if not exists public.monthly_reports (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid,
  month       date not null,  -- stored as YYYY-MM-01

  -- Business
  total_revenue       numeric(14,2),
  cash_collected      numeric(14,2),
  mrr                 numeric(14,2),
  ad_spend            numeric(14,2),
  software_costs      numeric(14,2),
  variable_costs      numeric(14,2),

  -- Sales pipeline
  scheduled_calls       int,
  attended_calls        int,
  qualified_calls       int,
  aplications           int,
  inbound_messages      int,
  offer_docs_sent       int,
  offer_docs_responded  int,
  cierres_por_offerdoc  int,
  new_clients           int,
  active_clients        int,

  -- Short-form (Instagram/TikTok/Reels)
  short_followers   int,
  short_reach       int,
  short_posts       int,

  -- YouTube
  yt_subscribers      int,
  yt_new_subscribers  int,
  yt_monthly_audience int,
  yt_views            int,
  yt_watch_time       int,
  yt_videos           int,

  -- Email
  email_subscribers     int,
  email_new_subscribers int,

  -- Reflection
  biggest_win    text,
  next_focus     text,
  support_needed text,
  improvements   text,
  nps_score      numeric(3,1),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (client_id, month)
);

create index if not exists idx_monthly_reports_client_month
  on public.monthly_reports(client_id, month desc);

alter table public.monthly_reports enable row level security;

-- Admins: full access
create policy "admin_all_monthly_reports" on public.monthly_reports
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Users: access only to their assigned client's reports
create policy "users_own_client_monthly_reports" on public.monthly_reports
  for all to authenticated
  using (client_id in (select client_id from public.profiles where id = auth.uid()))
  with check (client_id in (select client_id from public.profiles where id = auth.uid()));

-- Service role: full access
create policy "service_role_all_monthly_reports" on public.monthly_reports
  for all to service_role using (true) with check (true);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_monthly_reports_updated_at
  before update on public.monthly_reports
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
