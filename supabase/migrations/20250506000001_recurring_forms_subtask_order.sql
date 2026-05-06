-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Recurring tasks + Public Forms + Subtask ordering
--
-- 1. Columnas de recurrencia en tasks (recurrence_rule, last_generated_at)
-- 2. Nueva tabla task_forms para captar tareas vía form público
-- 3. Columna sort_order en tasks para ordenar subtareas con drag&drop
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Recurring tasks ──────────────────────────────────────────────────────
-- Una tarea con recurrence_rule actúa como "template" — al cargar el dashboard,
-- el server detecta cuáles necesitan generar instancias y las crea.

alter table public.tasks
  add column if not exists recurrence_rule text,        -- "daily" | "weekly" | "monthly" o RRULE
  add column if not exists recurrence_until date,       -- opcional: hasta cuándo
  add column if not exists last_generated_at timestamptz, -- última vez que generó instancia
  add column if not exists is_recurrence_template boolean not null default false;

create index if not exists idx_tasks_recurrence
  on public.tasks(is_recurrence_template, last_generated_at)
  where is_recurrence_template = true;


-- ── 2. Public forms ──────────────────────────────────────────────────────────
-- Cada form tiene un slug público. Al submit, se crea una tarea con los
-- valores del form mapeados a campos de tarea (title, description, etc).

create table if not exists public.task_forms (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,                     -- /forms/<slug>
  title       text not null,                            -- "Brief inicial"
  description text,                                     -- subtitle del form
  -- Configuración de campos: array de { key, label, type, required, placeholder }
  -- types soportados: text, longtext, email, phone, select, date
  fields      jsonb not null default '[]'::jsonb,
  -- Defaults para la tarea creada al submit
  default_priority text not null default 'media',
  default_tags     text[] not null default '{}',
  default_assignees text[] not null default '{}',
  default_status_set_id uuid references public.task_status_sets(id) on delete set null,
  -- Metadata
  is_active   boolean not null default true,
  submit_count integer not null default 0,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_task_forms_slug on public.task_forms(slug);
create index if not exists idx_task_forms_active on public.task_forms(is_active);

alter table public.task_forms enable row level security;

drop policy if exists "authenticated_all_task_forms" on public.task_forms;
drop policy if exists "service_role_all_task_forms"  on public.task_forms;
drop policy if exists "anon_read_active_forms"       on public.task_forms;

-- Auth: admins gestionan
create policy "authenticated_all_task_forms" on public.task_forms
  for all to authenticated using (true) with check (true);
create policy "service_role_all_task_forms" on public.task_forms
  for all to service_role using (true) with check (true);
-- Anon: solo pueden leer forms activos (para renderizar el form público)
create policy "anon_read_active_forms" on public.task_forms
  for select to anon using (is_active = true);

drop trigger if exists trg_task_forms_updated_at on public.task_forms;
create trigger trg_task_forms_updated_at
  before update on public.task_forms
  for each row execute function public.set_updated_at();

-- Tabla de submissions para audit (qué se mandó por cada form, sin perder data)
create table if not exists public.task_form_submissions (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.task_forms(id) on delete cascade,
  task_id      uuid references public.tasks(id) on delete set null,
  submitter_email text,
  submitter_name  text,
  payload      jsonb not null default '{}'::jsonb,
  ip           text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_form_submissions_form on public.task_form_submissions(form_id, created_at desc);

alter table public.task_form_submissions enable row level security;
drop policy if exists "authenticated_read_submissions" on public.task_form_submissions;
drop policy if exists "service_role_all_submissions"   on public.task_form_submissions;
create policy "authenticated_read_submissions" on public.task_form_submissions
  for select to authenticated using (true);
create policy "service_role_all_submissions" on public.task_form_submissions
  for all to service_role using (true) with check (true);


-- ── 3. Subtask ordering ─────────────────────────────────────────────────────
-- Permite reordenar subtareas con drag&drop dentro del drawer.
-- sort_order es un float — facilita inserciones entre dos posiciones existentes
-- sin renumerar todo.

alter table public.tasks
  add column if not exists sort_order double precision;

-- Backfill: asignar sort_order incremental a las subtareas existentes
-- agrupadas por parent.
do $$
declare
  r record;
  i int;
begin
  for r in
    select parent_id from public.tasks
    where parent_id is not null and sort_order is null
    group by parent_id
  loop
    i := 0;
    update public.tasks t
      set sort_order = i + sub.rn * 100.0
      from (
        select id, row_number() over (order by created_at) as rn
        from public.tasks
        where parent_id = r.parent_id and sort_order is null
      ) sub
      where t.id = sub.id;
  end loop;
end $$;

create index if not exists idx_tasks_parent_sort on public.tasks(parent_id, sort_order)
  where parent_id is not null;


-- ── 4. Sample form pre-cargado ──────────────────────────────────────────────
insert into public.task_forms (slug, title, description, fields, default_priority, default_tags)
select 'brief-inicial', 'Brief inicial de proyecto',
       'Contanos qué necesitás y nos ponemos en contacto en 24h.',
       '[
         {"key":"name",        "label":"Nombre",                   "type":"text",     "required":true,  "placeholder":"Tu nombre"},
         {"key":"email",       "label":"Email",                    "type":"email",    "required":true,  "placeholder":"tu@email.com"},
         {"key":"company",     "label":"Empresa / agency",         "type":"text",     "required":false, "placeholder":"Nombre"},
         {"key":"opportunity", "label":"Oportunidad / RFP",        "type":"text",     "required":true,  "placeholder":"Bid # o nombre"},
         {"key":"deadline",    "label":"Deadline (si lo conocés)", "type":"date",     "required":false, "placeholder":""},
         {"key":"context",     "label":"Contexto",                 "type":"longtext", "required":false, "placeholder":"Detalle, requisitos, presupuesto..."}
       ]'::jsonb,
       'alta',
       array['form','lead','brief']
where not exists (select 1 from public.task_forms where slug = 'brief-inicial');

notify pgrst, 'reload schema';
