create table if not exists public.crm_leads (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  email      text,
  tag        text,
  source     text,
  lead_type  text,
  status     text not null default 'nuevo',
  instagram  text,
  rating     int,
  niche      text,
  notes      text,
  created_at timestamptz not null default now()
);

alter table public.crm_leads enable row level security;

create policy "service_role_all_crm_leads" on public.crm_leads
  for all to service_role using (true) with check (true);
