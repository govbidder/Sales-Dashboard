create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  amount      numeric(14,2) not null default 0,
  status      text not null default 'pendiente',
  description text,
  created_at  timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "service_role_all_payments" on public.payments
  for all to service_role using (true) with check (true);
