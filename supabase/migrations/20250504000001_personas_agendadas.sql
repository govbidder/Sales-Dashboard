-- ─────────────────────────────────────────────────────────────────────────────
-- Personas Agendadas: people who booked a call to enter the mentorship/program.
-- Replaces the older crm_leads table.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.personas_agendadas (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text,
  phone         text,
  instagram     text,
  scheduled_at  timestamptz,                       -- cuándo es la llamada
  call_status   text not null default 'agendada',  -- agendada | atendida | no_show | cancelada | reagendada
  sales_status  text not null default 'pendiente', -- pendiente | propuesta | cerrada | perdida
  owner         text,                              -- email/nombre del miembro del equipo responsable
  source        text,                              -- de dónde vino
  rating        int,                               -- 1-5 calificación de calidad
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_personas_agendadas_scheduled
  on public.personas_agendadas(scheduled_at desc);
create index if not exists idx_personas_agendadas_owner
  on public.personas_agendadas(owner);

alter table public.personas_agendadas enable row level security;

-- Internal dashboard: any authenticated team member can do everything
create policy "authenticated_all_personas" on public.personas_agendadas
  for all to authenticated using (true) with check (true);
create policy "service_role_all_personas" on public.personas_agendadas
  for all to service_role using (true) with check (true);

-- updated_at trigger (reuses the function from monthly_reports migration)
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'set_updated_at') then
    execute 'create function public.set_updated_at() returns trigger language plpgsql as $f$ begin new.updated_at = now(); return new; end; $f$';
  end if;
end $$;

drop trigger if exists trg_personas_updated_at on public.personas_agendadas;
create trigger trg_personas_updated_at
  before update on public.personas_agendadas
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Seguimientos: follow-ups attached to a persona agendada (or other entities later)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.seguimientos (
  id            uuid primary key default gen_random_uuid(),
  persona_id    uuid references public.personas_agendadas(id) on delete cascade,
  type          text not null default 'nota',  -- nota | llamada | mensaje | email | reunion
  content       text,
  completed     boolean not null default false,
  owner         text,
  due_at        timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_seguimientos_persona on public.seguimientos(persona_id);
create index if not exists idx_seguimientos_due on public.seguimientos(due_at) where completed = false;

alter table public.seguimientos enable row level security;

create policy "authenticated_all_seguimientos" on public.seguimientos
  for all to authenticated using (true) with check (true);
create policy "service_role_all_seguimientos" on public.seguimientos
  for all to service_role using (true) with check (true);

notify pgrst, 'reload schema';
