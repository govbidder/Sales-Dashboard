-- ─────────────────────────────────────────────────────────────────────────────
-- Tasks: internal team task management with priority, owner, due date.
-- Optionally linkable to a persona_agendada (e.g. "follow up with Juan tomorrow").
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  status        text not null default 'pendiente',  -- pendiente | en_progreso | completada | cancelada
  priority      text not null default 'media',      -- baja | media | alta | urgente
  owner         text,                               -- email/nombre del responsable
  due_at        timestamptz,
  completed_at  timestamptz,

  -- Optional link to a persona agendada (for "task derivada de un seguimiento")
  persona_id    uuid references public.personas_agendadas(id) on delete set null,

  created_by    text,                               -- who created the task
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_tasks_owner    on public.tasks(owner);
create index if not exists idx_tasks_status   on public.tasks(status);
create index if not exists idx_tasks_due_at   on public.tasks(due_at) where status in ('pendiente', 'en_progreso');
create index if not exists idx_tasks_persona  on public.tasks(persona_id);

alter table public.tasks enable row level security;

create policy "authenticated_all_tasks" on public.tasks
  for all to authenticated using (true) with check (true);
create policy "service_role_all_tasks" on public.tasks
  for all to service_role using (true) with check (true);

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
