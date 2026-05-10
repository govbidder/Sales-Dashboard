-- ─────────────────────────────────────────────────────────────────────────────
-- Discovery — GovBidder General Dashboard
-- Form interno para que Santo + socio respondan juntos el cuestionario de
-- 35 preguntas (8 bloques) que enmarca la visión y el alcance del dashboard.
--
-- Slug público: /forms/discovery-dashboard
-- Idempotente: corre múltiples veces y refresca campos sin perder submissions.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.task_forms (
  slug,
  title,
  description,
  fields,
  default_priority,
  default_tags,
  default_assignees,
  is_active,
  created_by
) values (
  'discovery-dashboard',
  'Discovery — GovBidder General Dashboard',
  'Respondan los dos juntos. Si discrepan, escriban AMBAS opiniones — eso es lo más valioso. Si no saben, escriban "no sabemos todavía". Si no aplica, escriban "no aplica" y por qué. Tiempo estimado: 30-45 minutos.',
  $JSON$[
    { "key": "name",  "label": "Quién/quiénes responden (ej: Santo + socio)", "type": "text",  "required": true,  "placeholder": "Santo + Nombre del socio" },
    { "key": "email", "label": "Email de contacto",                            "type": "email", "required": true,  "placeholder": "santo@govbidder.com" },

    { "key": "q01", "label": "B1·Q1 — En 2 frases máximo: ¿qué es GovBidder y a quién se lo venden?", "type": "longtext", "required": false },
    { "key": "q02", "label": "B1·Q2 — ¿Cuál es el problema concreto que sus clientes tenían antes de contratarlos?", "type": "longtext", "required": false },
    { "key": "q03", "label": "B1·Q3 — ¿Cómo gana plata GovBidder hoy? (suscripción mensual, por proyecto, por licitación ganada, etc.)", "type": "longtext", "required": false },
    { "key": "q04", "label": "B1·Q4 — ¿Cuántos clientes tienen activos hoy? ¿Cómo proyectan crecer en 6 meses?", "type": "longtext", "required": false },
    { "key": "q05", "label": "B1·Q5 — ¿Quiénes son sus competidores directos? ¿Qué hacen ellos que ustedes no, y viceversa?", "type": "longtext", "required": false },

    { "key": "q06", "label": "B2·Q6 — Listen TODOS los roles internos (actuales o futuros) en el equipo y, en 1 línea, qué hace cada uno.", "type": "longtext", "required": false, "placeholder": "Founder — visión, ventas, decisiones finales\nSales Lead — gestiona pipeline y cierres\n..." },
    { "key": "q07", "label": "B2·Q7 — ¿Cuántas personas hay HOY en cada rol? ¿Cuántas habrá en 6 meses si todo va bien?", "type": "longtext", "required": false },
    { "key": "q08", "label": "B2·Q8 — Para CADA rol: ¿qué información necesita ver para hacer su trabajo? Sean específicos.", "type": "longtext", "required": false, "placeholder": "Sales Lead ve: leads asignados, deals en progreso, comisiones\nAccount Manager ve: clientes asignados, sus tareas, su pipeline" },
    { "key": "q09", "label": "B2·Q9 — Para CADA rol: ¿qué información NO debería ver? ¿Hay info confidencial que ciertos roles no pueden ver?", "type": "longtext", "required": false },
    { "key": "q10", "label": "B2·Q10 — ¿Hay un rol admin/founder que ve absolutamente todo? ¿Quiénes son?", "type": "longtext", "required": false },

    { "key": "q11", "label": "B3·Q11 — ¿Qué herramientas usan HOY para gestionar el negocio? Lista TODAS, aunque sean pequeñas.", "type": "longtext", "required": false, "placeholder": "Notion para tareas, Excel para finanzas, Slack para comunicación, Google Calendar..." },
    { "key": "q12", "label": "B3·Q12 — De esas, ¿cuáles QUIEREN reemplazar con el dashboard? ¿Cuáles NO quieren reemplazar y por qué?", "type": "longtext", "required": false },
    { "key": "q13", "label": "B3·Q13 — ¿Qué proceso del día a día les genera más fricción / pérdida de tiempo HOY? 1-3 ejemplos concretos.", "type": "longtext", "required": false },
    { "key": "q14", "label": "B3·Q14 — ¿Tienen procesos repetitivos (semanales, mensuales) que deberían automatizarse? Listenlos.", "type": "longtext", "required": false },
    { "key": "q15", "label": "B3·Q15 — ¿Hay info crítica del negocio que hoy NO está sistematizada (vive en cabezas, chats, mails sueltos)?", "type": "longtext", "required": false },

    { "key": "q16", "label": "B4·Q16 — Imaginen que abren el dashboard a las 7 AM, antes del café. ¿Qué necesitan ver INMEDIATAMENTE? Sean específicos.", "type": "longtext", "required": false, "placeholder": "Métricas de X, alertas de Y, tareas de Z..." },
    { "key": "q17", "label": "B4·Q17 — ¿Cuáles son las 3 funcionalidades MÁS IMPORTANTES (las indispensables, no las lindas-de-tener)?", "type": "longtext", "required": false },
    { "key": "q18", "label": "B4·Q18 — ¿Cuáles son funcionalidades lindas-de-tener que pueden esperar a v2 o v3?", "type": "longtext", "required": false },
    { "key": "q19", "label": "B4·Q19 — Si el dashboard SOLO hiciera 1 cosa bien, ¿cuál tendría que ser?", "type": "longtext", "required": false },
    { "key": "q20", "label": "B4·Q20 — ¿Cuándo van a saber que el dashboard funciona? Sean específicos.", "type": "longtext", "required": false, "placeholder": "Cuando todos lo usen diariamente, cuando reemplace Excel, cuando ahorremos X horas/semana..." },

    { "key": "q21", "label": "B5·Q21 — ¿Cómo asignan tareas hoy entre el equipo? ¿Cómo se entera alguien de que tiene una tarea nueva?", "type": "longtext", "required": false },
    { "key": "q22", "label": "B5·Q22 — ¿Quién puede asignar tareas a quién? ¿Solo founders? ¿Cualquier persona?", "type": "longtext", "required": false },
    { "key": "q23", "label": "B5·Q23 — ¿Las tareas se organizan por proyecto, cliente, departamento, o todo junto?", "type": "longtext", "required": false },
    { "key": "q24", "label": "B5·Q24 — ¿Hay tareas recurrentes (semanales, mensuales) que se repiten siempre?", "type": "longtext", "required": false },
    { "key": "q25", "label": "B5·Q25 — ¿Qué pasa cuando una tarea se atrasa? ¿Cómo se enteran?", "type": "longtext", "required": false },

    { "key": "q26", "label": "B6·Q26 — ¿Qué métricas/KPIs miden el éxito del negocio HOY? (Aunque las midan a mano)", "type": "longtext", "required": false },
    { "key": "q27", "label": "B6·Q27 — ¿Qué métricas QUERRÍAN medir pero hoy no pueden por falta de herramientas?", "type": "longtext", "required": false },
    { "key": "q28", "label": "B6·Q28 — ¿Quién necesita ver qué reportes y con qué frecuencia?", "type": "longtext", "required": false, "placeholder": "Founder ve revenue mensual, sales lead ve pipeline semanal..." },

    { "key": "q29", "label": "B7·Q29 — Si el equipo pasa de N personas hoy a 25 en 1 año, ¿qué tendría que poder hacer el dashboard que hoy no es necesario?", "type": "longtext", "required": false },
    { "key": "q30", "label": "B7·Q30 — ¿Imaginan que CLIENTES de GovBidder accedan a algún módulo? ¿A cuál? (CRÍTICO: cambia toda la arquitectura)", "type": "longtext", "required": false },
    { "key": "q31", "label": "B7·Q31 — ¿Integraciones con otras herramientas que sí o sí necesitan? (Stripe, Mailchimp, WhatsApp Business, APIs de gobierno, etc.)", "type": "longtext", "required": false },

    { "key": "q32", "label": "B8·Q32 — ¿Hay alguna decisión sobre el dashboard donde Santo y socio NO están de acuerdo? ¿Qué piensa cada uno?", "type": "longtext", "required": false },
    { "key": "q33", "label": "B8·Q33 — ¿Hay alguna feature que les vendieron / pensaron al principio pero hoy no creen que sea necesaria?", "type": "longtext", "required": false },
    { "key": "q34", "label": "B8·Q34 — Si tuvieran que poner el dashboard en producción REAL para todo el equipo en 30 días, ¿qué les preocupa más que pueda fallar?", "type": "longtext", "required": false },
    { "key": "q35", "label": "B8·Q35 — Cualquier cosa que sientan importante y no preguntamos.", "type": "longtext", "required": false }
  ]$JSON$::jsonb,
  'alta',
  array['discovery','product','dashboard'],
  array[]::text[],
  true,
  'migration:discovery-form'
)
on conflict (slug) do update set
  title             = excluded.title,
  description       = excluded.description,
  fields            = excluded.fields,
  default_priority  = excluded.default_priority,
  default_tags      = excluded.default_tags,
  is_active         = excluded.is_active,
  updated_at        = now();
