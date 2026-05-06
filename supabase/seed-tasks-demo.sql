-- ═══════════════════════════════════════════════════════════════════════════
-- Seed de tareas de muestra para gov contracting.
-- Idempotente: usa títulos únicos como ancla para no duplicar.
-- Pega esto en Supabase Dashboard → SQL Editor → Run.
--
-- Crea ~15 tareas realistas con due dates relativas a hoy, distribuidas en
-- los 4 estados del set Default, con tags y prioridades variadas. Algunas
-- tienen subtareas anidadas (parent_id).
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper: borrar tareas demo previas para poder re-correr limpio
delete from public.tasks
where title like '[DEMO]%';

-- ─── Parent tasks ────────────────────────────────────────────────────────────

insert into public.tasks
  (title, description, status, priority, due_at, tags, assignees, created_by)
values
  (
    '[DEMO] Bid: NAVAIR Hangar Maintenance',
    'RFP detectado en SAM.gov. Deadline submission viernes 23.',
    'en_progreso',
    'urgente',
    now() + interval '3 days',
    array['bid','rfp','navair'],
    array['santo@govbidder.com','marcelo@govbidder.com'],
    'santo@govbidder.com'
  ),
  (
    '[DEMO] Renovar SAM.gov antes del vencimiento',
    'UEI vence el 15. Sin renovación no se puede bidear.',
    'pendiente',
    'urgente',
    now() + interval '5 days',
    array['compliance','sam_gov'],
    array['santo@govbidder.com'],
    'santo@govbidder.com'
  ),
  (
    '[DEMO] Mandar capability statement a DOE',
    'Cliente DOE pidió statement adaptada al programa de energía solar.',
    'en_progreso',
    'alta',
    now() + interval '1 day',
    array['client','capability_statement'],
    array['marcelo@govbidder.com'],
    'santo@govbidder.com'
  ),
  (
    '[DEMO] Research agency: Bureau of Reclamation',
    'Profile completo de agency, NAICS preferidos, past awards.',
    'pendiente',
    'media',
    now() + interval '7 days',
    array['research','agency'],
    array['marcelo@govbidder.com'],
    'santo@govbidder.com'
  ),
  (
    '[DEMO] Decisión go/no-go: USACE Bridge Repair',
    'Reunión interna mañana 11hs para definir.',
    'pendiente',
    'alta',
    now() + interval '1 day',
    array['internal','decision'],
    array['santo@govbidder.com','laura@govbidder.com'],
    'santo@govbidder.com'
  ),
  (
    '[DEMO] Pricing matrix Air Force RFP',
    'Calcular pricing 3 escenarios: base + 2 opt years.',
    'en_progreso',
    'alta',
    now() + interval '4 days',
    array['pricing','bid'],
    array['laura@govbidder.com'],
    'santo@govbidder.com'
  ),
  (
    '[DEMO] Llamar a contracting officer DLA',
    'Confirmar fecha de site visit obligatoria.',
    'pendiente',
    'media',
    now() + interval '2 days',
    array['follow_up','client'],
    array['marcelo@govbidder.com'],
    'santo@govbidder.com'
  ),
  (
    '[DEMO] Submission DOD-2024-007',
    'Final submit en SAM.gov. CHECKLIST: technical + price + reps.',
    'pendiente',
    'urgente',
    now() - interval '6 hours',   -- VENCIDA
    array['submission','bid'],
    array['santo@govbidder.com'],
    'santo@govbidder.com'
  ),
  (
    '[DEMO] Follow-up post-debrief con NASA',
    'Cliente perdido. Pedir feedback formal del CO.',
    'pendiente',
    'baja',
    now() - interval '2 days',    -- VENCIDA hace 2 días
    array['follow_up','debrief'],
    array['marcelo@govbidder.com'],
    'santo@govbidder.com'
  ),
  (
    '[DEMO] Reporte mensual a Santo',
    'Cierre de mes: KPIs + pipeline + tareas vencidas.',
    'pendiente',
    'media',
    now() + interval '10 days',
    array['reporting','monthly'],
    array['marcelo@govbidder.com'],
    'santo@govbidder.com'
  ),
  (
    '[DEMO] Onboarding cliente XYZ Corp',
    'Kickoff agendado, pendiente compartir capability + plan 30 días.',
    'en_progreso',
    'alta',
    now() + interval '6 days',
    array['onboarding','client'],
    array['santo@govbidder.com','laura@govbidder.com'],
    'santo@govbidder.com'
  ),
  (
    '[DEMO] Past performance database update',
    'Agregar 3 contratos cerrados Q4 2024.',
    'completada',
    'baja',
    now() - interval '5 days',
    array['internal','past_performance'],
    array['laura@govbidder.com'],
    'santo@govbidder.com'
  ),
  (
    '[DEMO] Renovar GSA Schedule MAS',
    'Modificación bianual cargada y aprobada.',
    'completada',
    'media',
    now() - interval '12 days',
    array['compliance','gsa'],
    array['santo@govbidder.com'],
    'santo@govbidder.com'
  ),
  (
    '[DEMO] Bid VA Healthcare IT',
    'Cancelado: falta certificación 8(a) requerida.',
    'cancelada',
    'media',
    now() - interval '3 days',
    array['bid','cancelled'],
    array['santo@govbidder.com'],
    'santo@govbidder.com'
  );

-- ─── Subtasks del parent "Bid: NAVAIR Hangar Maintenance" ───────────────────

with parent as (
  select id from public.tasks where title = '[DEMO] Bid: NAVAIR Hangar Maintenance' limit 1
)
insert into public.tasks (title, status, priority, due_at, tags, assignees, parent_id, created_by)
select t.title, t.status, t.priority, t.due_at, t.tags, t.assignees, parent.id, 'santo@govbidder.com'
from parent, (values
  ('[DEMO] · Leer RFP completo + checklist',           'completada',  'alta',    now() - interval '2 days', array['rfp']::text[],            array['marcelo@govbidder.com']::text[]),
  ('[DEMO] · Research NAVAIR past awards',             'completada',  'media',   now() - interval '1 day',  array['research']::text[],       array['marcelo@govbidder.com']::text[]),
  ('[DEMO] · Capability statement adaptada',           'en_progreso', 'alta',    now() + interval '1 day',  array['capability_statement']::text[], array['marcelo@govbidder.com']::text[]),
  ('[DEMO] · Pricing matrix',                          'pendiente',   'alta',    now() + interval '2 days', array['pricing']::text[],        array['laura@govbidder.com']::text[]),
  ('[DEMO] · Technical proposal draft',                'pendiente',   'alta',    now() + interval '2 days', array['proposal']::text[],       array['marcelo@govbidder.com']::text[]),
  ('[DEMO] · Internal review',                         'pendiente',   'media',   now() + interval '3 days', array['review']::text[],         array['santo@govbidder.com']::text[]),
  ('[DEMO] · Submit en SAM.gov antes de las 23:59 ET', 'pendiente',   'urgente', now() + interval '3 days', array['submission']::text[],     array['santo@govbidder.com']::text[])
) as t(title, status, priority, due_at, tags, assignees);

-- ─── Comentarios de muestra en algunas tareas ───────────────────────────────

with target as (
  select id from public.tasks where title = '[DEMO] Mandar capability statement a DOE' limit 1
)
insert into public.task_comments (task_id, author, content, kind)
select target.id, c.author, c.content, c.kind
from target, (values
  ('santo@govbidder.com',   'Cliente está en programa solar — adaptá el messaging para enfatizar past performance en utility-scale.', 'comment'),
  ('marcelo@govbidder.com', 'Listo, primer borrador adjunto. ¿Lo revisás antes de mandar?',                                          'comment')
) as c(author, content, kind);

-- ─── Verificación ───────────────────────────────────────────────────────────
select
  status,
  count(*) as count
from public.tasks
where title like '[DEMO]%'
group by status
order by status;
