-- ─────────────────────────────────────────────────────────────────────────────
-- Task templates: pre-armado de "Nueva oportunidad de bid" y similares.
-- Aplicar un template crea una tarea principal + N subtasks predefinidas.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.task_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                       -- "Nueva oportunidad de bid"
  description   text,                                -- explicación libre
  icon          text,                                -- nombre de lucide icon (opcional)
  color         text default '#1e3a8a',              -- color de marca

  -- Configuración del parent
  parent_title         text not null,
  parent_description   text,
  parent_priority      text not null default 'media',
  parent_tags          text[] not null default '{}',
  parent_assignees     text[] not null default '{}',
  parent_due_offset_days int,                        -- null = sin fecha; positivo = días desde apply

  -- Lista de subtasks (estructura: [{title, priority, due_offset_days, tags}])
  subtasks      jsonb not null default '[]'::jsonb,

  is_default    boolean not null default false,      -- precargado al instalar
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_task_templates_default on public.task_templates(is_default);

alter table public.task_templates enable row level security;

create policy "authenticated_all_task_templates" on public.task_templates
  for all to authenticated using (true) with check (true);
create policy "service_role_all_task_templates" on public.task_templates
  for all to service_role using (true) with check (true);

drop trigger if exists trg_task_templates_updated_at on public.task_templates;
create trigger trg_task_templates_updated_at
  before update on public.task_templates
  for each row execute function public.set_updated_at();

-- ─── Templates por defecto para gov contracting ──────────────────────────────

insert into public.task_templates
  (name, description, icon, parent_title, parent_priority, parent_tags, parent_due_offset_days, subtasks, is_default)
values
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
on conflict do nothing;

notify pgrst, 'reload schema';
