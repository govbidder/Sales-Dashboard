create table if not exists public.chi_chang (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid references public.crm_clients(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete set null,
  fecha          date not null,
  valor_trato    numeric(14,2) not null,
  cash_collected numeric(14,2) not null,
  proximo_nivel  text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_chi_chang_client_id on public.chi_chang(client_id);
create index if not exists idx_chi_chang_fecha     on public.chi_chang(fecha desc);

alter table public.chi_chang enable row level security;

create policy "service_role_all_chi_chang" on public.chi_chang
  for all to service_role using (true) with check (true);
