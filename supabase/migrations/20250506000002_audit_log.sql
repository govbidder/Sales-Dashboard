-- ─────────────────────────────────────────────────────────────────────────────
-- Audit log: registro inmutable de acciones administrativas relevantes.
-- Quién hizo qué, sobre qué entidad, cuándo. Para investigar incidentes,
-- compliance, debugging.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor       text,                              -- email del usuario
  actor_role  text,                              -- admin | user
  action      text not null,                     -- "task.delete", "form.create", etc
  entity      text not null,                     -- "task", "form", "persona", "team_member"
  entity_id   text,                              -- ID de la entidad (nullable: bulk ops)
  payload     jsonb default '{}'::jsonb,         -- snapshot del before/after, context
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_actor      on public.audit_log(actor, created_at desc);
create index if not exists idx_audit_log_entity     on public.audit_log(entity, entity_id, created_at desc);
create index if not exists idx_audit_log_action     on public.audit_log(action, created_at desc);
create index if not exists idx_audit_log_created_at on public.audit_log(created_at desc);

alter table public.audit_log enable row level security;

-- Lectura: admins pueden ver TODO el audit log
create policy "admins_read_audit_log" on public.audit_log
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Service role puede insertar
create policy "service_role_all_audit_log" on public.audit_log
  for all to service_role using (true) with check (true);

notify pgrst, 'reload schema';
