-- ═══════════════════════════════════════════════════════════════════════════
-- GovBidder Sales Dashboard — Bootstrap completo
--
-- Este script aplica TODAS las migrations en orden, idempotentemente
-- (lo podés correr varias veces sin romper nada).
--
-- Cómo usarlo:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Pegá todo el contenido de este archivo.
--   3. Run.
--
-- Tiempo estimado: <10 segundos.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Función helper compartida ───────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PROFILES (usuarios del equipo)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique,
  full_name   text,
  role        text not null default 'user',         -- admin | user
  status      text not null default 'activo',       -- activo | invitado | inactivo
  client_id   uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists "users_own_profile_select" on public.profiles;
drop policy if exists "users_own_profile_update" on public.profiles;
drop policy if exists "admin_read_all_profiles"  on public.profiles;
drop policy if exists "service_role_all_profiles" on public.profiles;
create policy "users_own_profile_select"  on public.profiles for select to authenticated using (auth.uid() = id);
create policy "users_own_profile_update"  on public.profiles for update to authenticated using (auth.uid() = id);
-- IMPORTANTE: la policy de admin usa is_admin() (security definer) para evitar
-- recursión infinita. Si la consulta hiciera "select * from profiles where role=admin",
-- la policy se llamaría a sí misma → loop. La función bypasea RLS.
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
$$;
create policy "admin_read_all_profiles"   on public.profiles for select to authenticated using (public.is_admin());
create policy "service_role_all_profiles" on public.profiles for all to service_role using (true) with check (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. MONTHLY REPORTS (métricas mensuales)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.monthly_reports (
  id              uuid primary key default gen_random_uuid(),
  month           date not null unique,              -- YYYY-MM-01
  cash_collected  numeric default 0,
  total_revenue   numeric default 0,
  mrr             numeric default 0,
  ad_spend        numeric default 0,
  attended_calls  integer default 0,
  new_clients     integer default 0,
  notes           text,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_monthly_reports_month on public.monthly_reports(month desc);

alter table public.monthly_reports enable row level security;
drop policy if exists "authenticated_all_monthly_reports" on public.monthly_reports;
drop policy if exists "service_role_all_monthly_reports" on public.monthly_reports;
create policy "authenticated_all_monthly_reports" on public.monthly_reports for all to authenticated using (true) with check (true);
create policy "service_role_all_monthly_reports"  on public.monthly_reports for all to service_role using (true) with check (true);

drop trigger if exists trg_monthly_reports_updated_at on public.monthly_reports;
create trigger trg_monthly_reports_updated_at
  before update on public.monthly_reports
  for each row execute function public.set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. PERSONAS AGENDADAS + SEGUIMIENTOS
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.personas_agendadas (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text,
  phone           text,
  scheduled_at    timestamptz,
  call_status     text not null default 'pendiente',
  sales_status    text not null default 'pendiente',
  source          text,
  notes           text,
  owner           text,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_personas_agendadas_scheduled_at on public.personas_agendadas(scheduled_at desc);
create index if not exists idx_personas_agendadas_sales_status on public.personas_agendadas(sales_status);

alter table public.personas_agendadas enable row level security;
drop policy if exists "authenticated_all_personas"   on public.personas_agendadas;
drop policy if exists "service_role_all_personas"    on public.personas_agendadas;
create policy "authenticated_all_personas"   on public.personas_agendadas for all to authenticated using (true) with check (true);
create policy "service_role_all_personas"    on public.personas_agendadas for all to service_role using (true) with check (true);

drop trigger if exists trg_personas_agendadas_updated_at on public.personas_agendadas;
create trigger trg_personas_agendadas_updated_at
  before update on public.personas_agendadas
  for each row execute function public.set_updated_at();

create table if not exists public.seguimientos (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references public.personas_agendadas(id) on delete cascade,
  kind        text not null default 'note',
  content     text,
  author      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_seguimientos_persona on public.seguimientos(persona_id, created_at desc);

alter table public.seguimientos enable row level security;
drop policy if exists "authenticated_all_seguimientos" on public.seguimientos;
drop policy if exists "service_role_all_seguimientos"  on public.seguimientos;
create policy "authenticated_all_seguimientos" on public.seguimientos for all to authenticated using (true) with check (true);
create policy "service_role_all_seguimientos"  on public.seguimientos for all to service_role using (true) with check (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. TASKS (core)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  status        text not null default 'pendiente',
  priority      text not null default 'media',
  owner         text,
  due_at        timestamptz,
  completed_at  timestamptz,
  persona_id    uuid references public.personas_agendadas(id) on delete set null,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_tasks_owner   on public.tasks(owner);
create index if not exists idx_tasks_status  on public.tasks(status);
create index if not exists idx_tasks_due_at  on public.tasks(due_at) where status in ('pendiente', 'en_progreso');
create index if not exists idx_tasks_persona on public.tasks(persona_id);

alter table public.tasks enable row level security;
drop policy if exists "authenticated_all_tasks" on public.tasks;
drop policy if exists "service_role_all_tasks"  on public.tasks;
create policy "authenticated_all_tasks" on public.tasks for all to authenticated using (true) with check (true);
create policy "service_role_all_tasks"  on public.tasks for all to service_role using (true) with check (true);

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. TASKS — ClickUp upgrade (subtasks + tags + multi-assignees + comments)
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.tasks add column if not exists parent_id uuid references public.tasks(id) on delete cascade;
create index if not exists idx_tasks_parent on public.tasks(parent_id);

alter table public.tasks add column if not exists tags text[] not null default '{}';
create index if not exists idx_tasks_tags on public.tasks using gin(tags);

alter table public.tasks add column if not exists assignees text[] not null default '{}';
create index if not exists idx_tasks_assignees on public.tasks using gin(assignees);

create or replace function public.sync_task_owner_to_assignees()
returns trigger language plpgsql as $$
begin
  if new.owner is not null and new.owner <> '' then
    if not (new.owner = any(coalesce(new.assignees, '{}'))) then
      new.assignees = array_prepend(new.owner, coalesce(new.assignees, '{}'));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_sync_owner on public.tasks;
create trigger trg_tasks_sync_owner
  before insert or update on public.tasks
  for each row execute function public.sync_task_owner_to_assignees();

create table if not exists public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  author      text,
  content     text not null,
  kind        text not null default 'comment',
  created_at  timestamptz not null default now()
);
create index if not exists idx_task_comments_task on public.task_comments(task_id, created_at desc);

alter table public.task_comments enable row level security;
drop policy if exists "authenticated_all_task_comments" on public.task_comments;
drop policy if exists "service_role_all_task_comments"  on public.task_comments;
create policy "authenticated_all_task_comments" on public.task_comments for all to authenticated using (true) with check (true);
create policy "service_role_all_task_comments"  on public.task_comments for all to service_role using (true) with check (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RESOURCES
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  url         text,
  category    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.resources enable row level security;
drop policy if exists "authenticated_read_resources" on public.resources;
drop policy if exists "service_role_all_resources"   on public.resources;
create policy "authenticated_read_resources" on public.resources for select to authenticated using (true);
create policy "service_role_all_resources"   on public.resources for all to service_role using (true) with check (true);

drop trigger if exists trg_resources_updated_at on public.resources;
create trigger trg_resources_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. TASK TEMPLATES (workflows pre-armados)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.task_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  icon          text,
  color         text default '#1e3a8a',
  parent_title         text not null,
  parent_description   text,
  parent_priority      text not null default 'media',
  parent_tags          text[] not null default '{}',
  parent_assignees     text[] not null default '{}',
  parent_due_offset_days int,
  subtasks      jsonb not null default '[]'::jsonb,
  is_default    boolean not null default false,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_task_templates_default on public.task_templates(is_default);

alter table public.task_templates enable row level security;
drop policy if exists "authenticated_all_task_templates" on public.task_templates;
drop policy if exists "service_role_all_task_templates"  on public.task_templates;
create policy "authenticated_all_task_templates" on public.task_templates for all to authenticated using (true) with check (true);
create policy "service_role_all_task_templates"  on public.task_templates for all to service_role using (true) with check (true);

drop trigger if exists trg_task_templates_updated_at on public.task_templates;
create trigger trg_task_templates_updated_at
  before update on public.task_templates
  for each row execute function public.set_updated_at();

-- Templates default (idempotente: no inserta si ya existen los nombres).
insert into public.task_templates (name, description, icon, parent_title, parent_priority, parent_tags, parent_due_offset_days, subtasks, is_default)
select * from (values
  (
    'Nueva oportunidad de bid',
    'Workflow estándar desde que detectás un RFP hasta la submission.',
    'Briefcase',
    'Bid: <nombre del RFP>',
    'alta',
    array['bid','pipeline'],
    21,
    '[
      {"title":"Research de la agency contratante","priority":"media","due_offset_days":2,"tags":["research"]},
      {"title":"Leer RFP completo + checklist requisitos","priority":"alta","due_offset_days":3,"tags":["rfp"]},
      {"title":"Decisión go/no-go","priority":"alta","due_offset_days":4,"tags":["internal"]},
      {"title":"Armar capability statement adaptada","priority":"media","due_offset_days":7,"tags":["capability_statement"]},
      {"title":"Pricing matrix","priority":"alta","due_offset_days":12,"tags":["pricing"]},
      {"title":"Technical proposal draft","priority":"alta","due_offset_days":15,"tags":["proposal"]},
      {"title":"Internal review","priority":"media","due_offset_days":18,"tags":["review"]},
      {"title":"Submit antes del deadline","priority":"urgente","due_offset_days":21,"tags":["submission"]}
    ]'::jsonb,
    true
  ),
  (
    'Onboarding de cliente nuevo',
    'Pasos para empezar a trabajar con un cliente recién firmado.',
    'UserPlus',
    'Onboarding: <nombre del cliente>',
    'alta',
    array['onboarding','client'],
    14,
    '[
      {"title":"Kickoff call agendado","priority":"alta","due_offset_days":2,"tags":["meeting"]},
      {"title":"Compartir capability statement + past performance","priority":"media","due_offset_days":3,"tags":["client"]},
      {"title":"Setup de canal de comunicación (Slack/email)","priority":"media","due_offset_days":3,"tags":["internal"]},
      {"title":"Dejar contrato firmado en archivo","priority":"alta","due_offset_days":5,"tags":["legal"]},
      {"title":"Plan de los primeros 30 días","priority":"alta","due_offset_days":7,"tags":["planning"]},
      {"title":"Check-in de la semana 2","priority":"media","due_offset_days":14,"tags":["follow_up"]}
    ]'::jsonb,
    true
  ),
  (
    'Renovación de SAM.gov',
    'Anual. Si no se renueva, no se puede bidear.',
    'ShieldCheck',
    'Renovar SAM.gov',
    'urgente',
    array['compliance','sam_gov'],
    30,
    '[
      {"title":"Verificar UEI vigente","priority":"alta","due_offset_days":1,"tags":["sam_gov"]},
      {"title":"Actualizar NAICS codes si hace falta","priority":"media","due_offset_days":3,"tags":["sam_gov"]},
      {"title":"Renovar entity registration en SAM.gov","priority":"alta","due_offset_days":7,"tags":["sam_gov"]},
      {"title":"Confirmar status activo","priority":"alta","due_offset_days":10,"tags":["sam_gov"]},
      {"title":"Notificar al equipo el cambio (si hubo)","priority":"baja","due_offset_days":14,"tags":["internal"]}
    ]'::jsonb,
    true
  ),
  (
    'Reporte mensual del mes',
    'Cierre de mes — métricas + reporte para Santo.',
    'FileBarChart',
    'Cierre de mes: <Mes Año>',
    'alta',
    array['reporting','monthly'],
    5,
    '[
      {"title":"Cargar métricas en /admin/reports","priority":"alta","due_offset_days":1,"tags":["reporting"]},
      {"title":"Verificar pipeline + personas activas","priority":"media","due_offset_days":2,"tags":["pipeline"]},
      {"title":"Revisar tareas vencidas","priority":"media","due_offset_days":2,"tags":["internal"]},
      {"title":"Mandar reporte ejecutivo a Santo","priority":"alta","due_offset_days":5,"tags":["reporting"]}
    ]'::jsonb,
    true
  )
) as t(name, description, icon, parent_title, parent_priority, parent_tags, parent_due_offset_days, subtasks, is_default)
where not exists (select 1 from public.task_templates tpl where tpl.name = t.name);


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. NOTIFICATIONS (in-app feed)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  recipient   text not null,
  kind        text not null,
  title       text not null,
  body        text,
  href        text,
  payload     jsonb default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notifications_recipient_unread
  on public.notifications(recipient, created_at desc) where read_at is null;
create index if not exists idx_notifications_recipient_all
  on public.notifications(recipient, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "users_read_own_notifications"   on public.notifications;
drop policy if exists "users_update_own_notifications" on public.notifications;
drop policy if exists "service_role_all_notifications" on public.notifications;
create policy "users_read_own_notifications" on public.notifications
  for select to authenticated using (recipient = auth.jwt() ->> 'email');
create policy "users_update_own_notifications" on public.notifications
  for update to authenticated using (recipient = auth.jwt() ->> 'email')
  with check (recipient = auth.jwt() ->> 'email');
create policy "service_role_all_notifications" on public.notifications
  for all to service_role using (true) with check (true);

create or replace function public.notify_task_assignees()
returns trigger language plpgsql security definer as $$
declare a text;
begin
  if new.assignees is null or array_length(new.assignees, 1) is null then return new; end if;
  foreach a in array new.assignees loop
    if a is not null and a <> '' and (new.created_by is distinct from a) then
      insert into public.notifications (recipient, kind, title, body, href, payload)
      values (a, 'task_assigned', 'Nueva tarea asignada',
              coalesce(new.created_by, 'Alguien') || ' te asignó: ' || new.title,
              '/admin/tasks',
              jsonb_build_object('task_id', new.id, 'priority', new.priority));
    end if;
  end loop;
  return new;
end; $$;

drop trigger if exists trg_notify_task_assignees on public.tasks;
create trigger trg_notify_task_assignees
  after insert on public.tasks
  for each row execute function public.notify_task_assignees();

create or replace function public.notify_task_assignees_diff()
returns trigger language plpgsql security definer as $$
declare a text; old_set text[];
begin
  old_set := coalesce(old.assignees, '{}');
  if new.assignees is null or array_length(new.assignees, 1) is null then return new; end if;
  foreach a in array new.assignees loop
    if a is not null and a <> '' and not (a = any(old_set)) then
      insert into public.notifications (recipient, kind, title, body, href, payload)
      values (a, 'task_assigned', 'Te asignaron una tarea', 'Te asignaron: ' || new.title,
              '/admin/tasks',
              jsonb_build_object('task_id', new.id, 'priority', new.priority));
    end if;
  end loop;
  return new;
end; $$;

drop trigger if exists trg_notify_task_assignees_diff on public.tasks;
create trigger trg_notify_task_assignees_diff
  after update of assignees on public.tasks
  for each row execute function public.notify_task_assignees_diff();

create or replace function public.notify_task_comment_mentions()
returns trigger language plpgsql security definer as $$
declare a text; task_row record;
begin
  if new.kind = 'system' then return new; end if;
  select id, title, assignees, created_by into task_row from public.tasks where id = new.task_id;
  if not found then return new; end if;

  if task_row.assignees is not null then
    foreach a in array task_row.assignees loop
      if a is not null and a <> '' and (new.author is distinct from a) then
        insert into public.notifications (recipient, kind, title, body, href, payload)
        values (a, 'task_mention', 'Nuevo comentario',
                coalesce(new.author, 'Alguien') || ' comentó en: ' || task_row.title,
                '/admin/tasks',
                jsonb_build_object('task_id', new.task_id, 'comment_id', new.id));
      end if;
    end loop;
  end if;

  if task_row.created_by is not null
     and (new.author is distinct from task_row.created_by)
     and not (task_row.created_by = any(coalesce(task_row.assignees, '{}'))) then
    insert into public.notifications (recipient, kind, title, body, href, payload)
    values (task_row.created_by, 'task_mention', 'Nuevo comentario en tu tarea',
            coalesce(new.author, 'Alguien') || ' comentó en: ' || task_row.title,
            '/admin/tasks',
            jsonb_build_object('task_id', new.task_id, 'comment_id', new.id));
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_task_comment_mentions on public.task_comments;
create trigger trg_notify_task_comment_mentions
  after insert on public.task_comments
  for each row execute function public.notify_task_comment_mentions();


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. TASK STATUS SETS (workflows custom por board)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.task_status_sets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_default  boolean not null default false,
  statuses    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists idx_task_status_sets_default
  on public.task_status_sets(is_default) where is_default = true;

alter table public.task_status_sets enable row level security;
drop policy if exists "authenticated_all_status_sets" on public.task_status_sets;
drop policy if exists "service_role_all_status_sets"  on public.task_status_sets;
create policy "authenticated_all_status_sets" on public.task_status_sets for all to authenticated using (true) with check (true);
create policy "service_role_all_status_sets"  on public.task_status_sets for all to service_role using (true) with check (true);

drop trigger if exists trg_task_status_sets_updated_at on public.task_status_sets;
create trigger trg_task_status_sets_updated_at
  before update on public.task_status_sets
  for each row execute function public.set_updated_at();

insert into public.task_status_sets (name, description, is_default, statuses)
select * from (values
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
) as t(name, description, is_default, statuses)
where not exists (select 1 from public.task_status_sets s where s.name = t.name);

alter table public.tasks add column if not exists status_set_id uuid references public.task_status_sets(id) on delete set null;
create index if not exists idx_tasks_status_set on public.tasks(status_set_id);


-- ─── Refresh schema ─────────────────────────────────────────────────────────
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- LISTO. Verificación rápida:
-- ═══════════════════════════════════════════════════════════════════════════
-- select count(*) as templates_count    from public.task_templates;     -- esperar ≥4
-- select count(*) as status_sets_count  from public.task_status_sets;   -- esperar ≥2
-- select count(*) as profiles_count     from public.profiles;
-- select count(*) as tasks_count        from public.tasks;
