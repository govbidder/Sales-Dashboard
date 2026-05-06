-- ─────────────────────────────────────────────────────────────────────────────
-- Custom statuses por workspace.
-- Modelo simple: una tabla de "status sets" donde cada uno define un orden
-- de columnas con label, key (machine), color y orden. Cada tarea opcionalmente
-- referencia un status_set; si no, usa el set "default" pre-cargado.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.task_status_sets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                   -- "Default", "Gov Bid Pipeline"
  description text,
  is_default  boolean not null default false,
  -- Orden de columnas: [{ key, label, color }] como JSON
  -- key: machine identifier (snake_case, único dentro del set)
  -- label: display
  -- color: hex con #
  -- terminal: si es status final (ej "completada", "lost"). Triggers de overdue
  --           ignoran tareas en status terminal.
  statuses    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists idx_task_status_sets_default
  on public.task_status_sets(is_default) where is_default = true;

alter table public.task_status_sets enable row level security;
create policy "authenticated_all_status_sets" on public.task_status_sets
  for all to authenticated using (true) with check (true);
create policy "service_role_all_status_sets" on public.task_status_sets
  for all to service_role using (true) with check (true);

drop trigger if exists trg_task_status_sets_updated_at on public.task_status_sets;
create trigger trg_task_status_sets_updated_at
  before update on public.task_status_sets
  for each row execute function public.set_updated_at();

-- Pre-load: el set "Default" (matchea los hardcoded actuales) y el "Gov Bid Pipeline".
insert into public.task_status_sets (name, description, is_default, statuses) values
  (
    'Default',
    'Workflow estándar de tareas internas.',
    true,
    '[
      {"key":"pendiente",   "label":"Pendiente",   "color":"#94a3b8", "terminal":false},
      {"key":"en_progreso", "label":"En progreso", "color":"#1e3a8a", "terminal":false},
      {"key":"completada",  "label":"Completada",  "color":"#10b981", "terminal":true},
      {"key":"cancelada",   "label":"Cancelada",   "color":"#71717a", "terminal":true}
    ]'::jsonb
  ),
  (
    'Gov Bid Pipeline',
    'Para oportunidades de bid gov-contracting: detección → submit → award/lost.',
    false,
    '[
      {"key":"identificada", "label":"Identificada", "color":"#94a3b8", "terminal":false},
      {"key":"analisis",     "label":"En análisis",  "color":"#1e3a8a", "terminal":false},
      {"key":"propuesta",    "label":"Propuesta",    "color":"#f59e0b", "terminal":false},
      {"key":"submitted",    "label":"Submitted",    "color":"#7c3aed", "terminal":false},
      {"key":"awarded",      "label":"Awarded",      "color":"#10b981", "terminal":true},
      {"key":"lost",         "label":"Lost",         "color":"#E42D2C", "terminal":true}
    ]'::jsonb
  )
on conflict do nothing;

-- Cada task puede referenciar un set específico (null = default).
alter table public.tasks
  add column if not exists status_set_id uuid references public.task_status_sets(id) on delete set null;

create index if not exists idx_tasks_status_set on public.tasks(status_set_id);

-- View helper: lista de status válidos por task. La UI puede usar esto o
-- consultar directamente status_set_id.
notify pgrst, 'reload schema';
