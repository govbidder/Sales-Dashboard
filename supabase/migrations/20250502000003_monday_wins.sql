create table if not exists public.monday_wins (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.crm_clients(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  fecha         date not null,
  logro_1       text not null,
  logro_2       text,
  logro_3       text,
  una_sola_cosa text not null,
  bloqueo       text not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_monday_wins_client_id on public.monday_wins(client_id);
create index if not exists idx_monday_wins_fecha     on public.monday_wins(fecha desc);

alter table public.monday_wins enable row level security;

create policy "service_role_all_monday_wins" on public.monday_wins
  for all to service_role using (true) with check (true);
