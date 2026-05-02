-- ============================================================
-- GovBidder Sales Dashboard — Full Schema
-- Safe to re-run: all CREATE are IF NOT EXISTS, policies are
-- dropped and recreated, triggers use DROP IF EXISTS first.
-- ============================================================

-- ─── PROFILES ────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'user',
  full_name   text,
  client_id   uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "users_own_profile_select"   on public.profiles;
drop policy if exists "users_own_profile_update"   on public.profiles;
drop policy if exists "admin_read_all_profiles"    on public.profiles;
drop policy if exists "service_role_all_profiles"  on public.profiles;

create policy "users_own_profile_select" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "users_own_profile_update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "admin_read_all_profiles" on public.profiles
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "service_role_all_profiles" on public.profiles
  for all to service_role using (true) with check (true);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── CLIENTS ─────────────────────────────────────────────────
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.clients enable row level security;

drop policy if exists "admin_all_clients"          on public.clients;
drop policy if exists "users_read_own_client"      on public.clients;
drop policy if exists "service_role_all_clients_top" on public.clients;

create policy "admin_all_clients" on public.clients
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "users_read_own_client" on public.clients
  for select to authenticated
  using (id in (select client_id from public.profiles where id = auth.uid()));

create policy "service_role_all_clients_top" on public.clients
  for all to service_role using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'profiles_client_id_fkey' and table_name = 'profiles'
  ) then
    alter table public.profiles
      add constraint profiles_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete set null;
  end if;
end $$;

-- ─── MONTHLY REPORTS ─────────────────────────────────────────
create table if not exists public.monthly_reports (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  month       date not null,

  total_revenue         numeric(14,2),
  cash_collected        numeric(14,2),
  mrr                   numeric(14,2),
  ad_spend              numeric(14,2),
  software_costs        numeric(14,2),
  variable_costs        numeric(14,2),

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

  short_followers       int,
  short_reach           int,
  short_posts           int,

  yt_subscribers        int,
  yt_new_subscribers    int,
  yt_monthly_audience   int,
  yt_views              int,
  yt_watch_time         int,
  yt_videos             int,

  email_subscribers     int,
  email_new_subscribers int,

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

drop policy if exists "admin_all_monthly_reports"          on public.monthly_reports;
drop policy if exists "users_own_client_monthly_reports"   on public.monthly_reports;
drop policy if exists "service_role_all_monthly_reports"   on public.monthly_reports;

create policy "admin_all_monthly_reports" on public.monthly_reports
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "users_own_client_monthly_reports" on public.monthly_reports
  for all to authenticated
  using (client_id in (select client_id from public.profiles where id = auth.uid()))
  with check (client_id in (select client_id from public.profiles where id = auth.uid()));

create policy "service_role_all_monthly_reports" on public.monthly_reports
  for all to service_role using (true) with check (true);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_monthly_reports_updated_at on public.monthly_reports;
create trigger trg_monthly_reports_updated_at
  before update on public.monthly_reports
  for each row execute function public.set_updated_at();

-- ─── CRM CLIENTS ─────────────────────────────────────────────
create table if not exists public.crm_clients (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  email               text,
  instagram           text,
  phone               text,
  program_start       date not null,
  num_installments    int not null default 1,
  installment_amount  numeric(12,2) not null default 0,
  status              text not null default 'activo',
  notes               text,
  setter              text,
  closer              text,
  programa            text,
  forma_pago          text,
  total_amount        numeric(12,2),
  address             text,
  dashboard_email     text,
  dashboard_password  text,
  program_duration    int,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.crm_clients enable row level security;

drop policy if exists "service_role_all_clients" on public.crm_clients;
create policy "service_role_all_clients" on public.crm_clients
  for all to service_role using (true) with check (true);

create table if not exists public.crm_installments (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.crm_clients(id) on delete cascade,
  installment_number  int not null,
  due_date            date not null,
  amount              numeric(12,2) not null,
  paid_at             timestamptz,
  notes               text,
  created_at          timestamptz not null default now()
);

alter table public.crm_installments enable row level security;

drop policy if exists "service_role_all_installments" on public.crm_installments;
create policy "service_role_all_installments" on public.crm_installments
  for all to service_role using (true) with check (true);

create table if not exists public.crm_followups (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.crm_clients(id) on delete cascade,
  scheduled_date  date not null,
  type            text not null default 'whatsapp',
  notes           text,
  completed       boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.crm_followups enable row level security;

drop policy if exists "service_role_all_followups" on public.crm_followups;
create policy "service_role_all_followups" on public.crm_followups
  for all to service_role using (true) with check (true);

-- ─── RESOURCES ───────────────────────────────────────────────
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  url         text not null,
  description text,
  category    text not null default 'General',
  type        text not null default 'link',
  created_at  timestamptz not null default now()
);

alter table public.resources enable row level security;

drop policy if exists "service_role_all_resources"    on public.resources;
drop policy if exists "authenticated_read_resources"  on public.resources;

create policy "service_role_all_resources" on public.resources
  for all to service_role using (true) with check (true);

create policy "authenticated_read_resources" on public.resources
  for select to authenticated using (true);

-- ─── VIDEO FEED ACCOUNTS ─────────────────────────────────────
create table if not exists public.video_feed_accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade unique,
  platform       text,
  channel_url    text,
  channel_name   text,
  channel_avatar text,
  posts          jsonb,
  updated_at     timestamptz default now()
);

alter table public.video_feed_accounts enable row level security;

drop policy if exists "user_own_video_feed"   on public.video_feed_accounts;
drop policy if exists "admin_all_video_feed"  on public.video_feed_accounts;

create policy "user_own_video_feed" on public.video_feed_accounts
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "admin_all_video_feed" on public.video_feed_accounts
  for all to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- ─── CONTENT RESEARCH HISTORY ────────────────────────────────
create table if not exists public.content_research_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  channel_url     text not null,
  channel_name    text,
  channel_avatar  text,
  timeframe_days  int,
  platform        text,
  videos          jsonb,
  created_at      timestamptz default now()
);

alter table public.content_research_history enable row level security;

drop policy if exists "admin_all_content_research_history" on public.content_research_history;
drop policy if exists "user_own_content_research_history"  on public.content_research_history;

create policy "admin_all_content_research_history" on public.content_research_history
  for all to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

create policy "user_own_content_research_history" on public.content_research_history
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists content_research_history_user_id_idx
  on public.content_research_history(user_id, created_at desc);

-- ─── TRANSCRIPT HISTORY ──────────────────────────────────────
create table if not exists public.transcript_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  url         text not null,
  title       text,
  creator     text,
  duration    text,
  transcript  text,
  summary     text,
  created_at  timestamptz default now()
);

alter table public.transcript_history enable row level security;

drop policy if exists "admin_all_transcript_history" on public.transcript_history;
drop policy if exists "user_own_transcript_history"  on public.transcript_history;

create policy "admin_all_transcript_history" on public.transcript_history
  for all to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

create policy "user_own_transcript_history" on public.transcript_history
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists transcript_history_user_id_idx
  on public.transcript_history(user_id, created_at desc);

-- ─── COMPETITOR POSTS ────────────────────────────────────────
create table if not exists public.competitor_posts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete cascade,
  creator     text not null,
  post_url    text,
  description text,
  views       bigint,
  duration    text,
  likes       bigint,
  comments    bigint,
  transcript  text,
  analysis    text,
  created_at  timestamptz default now()
);

create index if not exists idx_competitor_posts_client_id  on public.competitor_posts(client_id);
create index if not exists idx_competitor_posts_created_at on public.competitor_posts(created_at desc);

alter table public.competitor_posts enable row level security;

drop policy if exists "admin_all_competitor_posts"        on public.competitor_posts;
drop policy if exists "client_read_own_competitor_posts"  on public.competitor_posts;

create policy "admin_all_competitor_posts" on public.competitor_posts
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) = 'admin'));

create policy "client_read_own_competitor_posts" on public.competitor_posts
  for select
  using (client_id in (select p.client_id from public.profiles p where p.id = auth.uid()));

-- ─── RESEARCH REQUESTS / RESULTS ─────────────────────────────
create table if not exists public.research_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  client_id      uuid references public.clients(id),
  platform       text check (platform in ('youtube','instagram','tiktok')) not null,
  timeframe_days int check (timeframe_days in (30,60,90)) not null,
  competitors    jsonb not null,
  status         text default 'pending' check (status in ('pending','processing','completed','failed')),
  attempts       int default 0,
  created_at     timestamptz default now(),
  started_at     timestamptz,
  completed_at   timestamptz,
  error_message  text
);

create index if not exists idx_research_requests_status  on public.research_requests(status);
create index if not exists idx_research_requests_user_id on public.research_requests(user_id);

create table if not exists public.research_results (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid references public.research_requests(id) on delete cascade not null,
  summary             text,
  patterns            jsonb,
  top_hooks           jsonb,
  opportunities       jsonb,
  recommended_ideas   jsonb,
  raw_competitor_data jsonb,
  created_at          timestamptz default now()
);

create index if not exists idx_research_results_request_id on public.research_results(request_id);

alter table public.research_requests enable row level security;
alter table public.research_results  enable row level security;

drop policy if exists "Select own requests" on public.research_requests;
drop policy if exists "Insert own requests" on public.research_requests;
drop policy if exists "Select own results"  on public.research_results;

create policy "Select own requests" on public.research_requests
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) = 'admin')
  );

create policy "Insert own requests" on public.research_requests
  for insert with check (auth.uid() = user_id);

create policy "Select own results" on public.research_results
  for select using (
    exists (select 1 from public.research_requests r where r.id = request_id and r.user_id = auth.uid())
  );

create or replace function public.get_next_pending_request()
returns table (
  id uuid, user_id uuid, platform text, timeframe_days int, competitors jsonb,
  status text, attempts int, created_at timestamptz, started_at timestamptz,
  completed_at timestamptz, error_message text
) language plpgsql as $$
declare req record;
begin
  select * into req from public.research_requests
    where status = 'pending' order by created_at for update skip locked limit 1;
  if not found then return; end if;
  update public.research_requests
    set status = 'processing', attempts = coalesce(attempts,0) + 1, started_at = now()
    where id = req.id;
  return query select r.id, r.user_id, r.platform, r.timeframe_days, r.competitors,
    r.status, r.attempts, r.created_at, r.started_at, r.completed_at, r.error_message
    from public.research_requests r where r.id = req.id;
end;
$$;

-- ─── AI DIAGNOSIS ─────────────────────────────────────────────
create table if not exists public.ai_diagnosis_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  prompt         text not null,
  audit_type     text,
  annual_revenue text,
  selected_month text,
  client_id      uuid,
  status         text default 'pending',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists public.ai_diagnosis_results (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid references public.ai_diagnosis_requests(id) on delete cascade,
  result       text,
  raw_response jsonb,
  created_at   timestamptz default now()
);

create index if not exists idx_ai_diag_user_id    on public.ai_diagnosis_requests(user_id);
create index if not exists idx_ai_diag_request_id on public.ai_diagnosis_results(request_id);

-- ─── OUTBOUND EVENTS ─────────────────────────────────────────
create table if not exists public.outbound_events (
  id            uuid primary key default gen_random_uuid(),
  event_type    text not null,
  payload       jsonb not null default '{}',
  status        text not null default 'pending',
  attempts      int not null default 0,
  max_attempts  int not null default 3,
  error_message text,
  client_id     uuid,
  user_id       uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  next_retry_at timestamptz not null default now(),
  processed_at  timestamptz
);

create index if not exists idx_outbound_events_status_retry
  on public.outbound_events (status, next_retry_at)
  where status in ('pending', 'failed');

create index if not exists idx_outbound_events_client_id on public.outbound_events(client_id);

alter table public.outbound_events enable row level security;

drop policy if exists "Service role full access on outbound_events" on public.outbound_events;
drop policy if exists "Users can read own events"                   on public.outbound_events;

create policy "Service role full access on outbound_events" on public.outbound_events
  for all using (auth.role() = 'service_role');

create policy "Users can read own events" on public.outbound_events
  for select using (auth.uid() = user_id);

create table if not exists public.event_logs (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.outbound_events(id) on delete cascade,
  level      text not null default 'info',
  message    text not null,
  metadata   jsonb default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_event_logs_event_id on public.event_logs(event_id);

alter table public.event_logs enable row level security;

drop policy if exists "Service role full access on event_logs" on public.event_logs;
drop policy if exists "Users can read own event logs"          on public.event_logs;

create policy "Service role full access on event_logs" on public.event_logs
  for all using (auth.role() = 'service_role');

create policy "Users can read own event logs" on public.event_logs
  for select using (
    exists (select 1 from public.outbound_events oe where oe.id = event_id and oe.user_id = auth.uid())
  );

create or replace function public.update_outbound_events_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_outbound_events_updated_at on public.outbound_events;
create trigger trg_outbound_events_updated_at
  before update on public.outbound_events
  for each row execute function public.update_outbound_events_updated_at();

create or replace function public.get_pending_events(batch_size int default 10)
returns setof public.outbound_events language plpgsql security definer as $$
begin
  return query
    select * from public.outbound_events
    where status in ('pending', 'failed')
      and next_retry_at <= now()
      and attempts < max_attempts
    order by next_retry_at asc
    limit batch_size
    for update skip locked;
end;
$$;

notify pgrst, 'reload schema';
