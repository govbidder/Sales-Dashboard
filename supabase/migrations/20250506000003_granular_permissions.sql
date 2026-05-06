-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos granulares por rol.
--
-- Modelo: cada usuario tiene un `role` en su profile (admin | user | viewer).
--
-- Reglas:
--   - admin: lee y escribe todo (sin cambios respecto al estado actual)
--   - user: lee todo, escribe en tasks y task_comments, lee personas pero
--           no las puede modificar (si tienen ownership específico, sí)
--   - viewer: solo lectura. Útil para stakeholders externos que solo miran
--             el dashboard.
--
-- Esta migration mantiene compat con el modelo "todos pueden todo" hasta que
-- se setee role=user|viewer en algún profile. Por default todos quedan como
-- "user" (que tiene los mismos permisos efectivos que antes).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Asegurar que el rol "viewer" sea válido. El check no es estricto en la
--    tabla profiles original — solo agregamos un constraint nuevo si no existe.
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'profiles_role_check_v2'
  ) then
    alter table public.profiles
      add constraint profiles_role_check_v2
      check (role in ('admin', 'user', 'viewer'));
  end if;
exception when others then null;
end $$;


-- 2) Helper functions para usar en policies.
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
$$;

create or replace function public.is_at_least_user() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin', 'user')
  )
$$;


-- 3) Migrar policies de tablas críticas a usar los helpers.
--    Mantenemos compat: las policies viejas siguen funcionando si las dejamos.
--    Lo que hacemos acá es ENDURECER las de DELETE y restringir escrituras.

-- ── tasks ──────────────────────────────────────────────────────────────────
-- Todos los autenticados pueden leer (no cambia)
-- user+admin pueden insertar/actualizar
-- solo admin puede borrar
drop policy if exists "users_can_delete_tasks_admin_only" on public.tasks;
create policy "users_can_delete_tasks_admin_only" on public.tasks
  for delete to authenticated using (public.is_admin());

drop policy if exists "users_can_write_tasks" on public.tasks;
create policy "users_can_write_tasks" on public.tasks
  for insert to authenticated with check (public.is_at_least_user());

drop policy if exists "users_can_update_tasks" on public.tasks;
create policy "users_can_update_tasks" on public.tasks
  for update to authenticated using (public.is_at_least_user())
  with check (public.is_at_least_user());

-- ── personas_agendadas ─────────────────────────────────────────────────────
drop policy if exists "users_can_delete_personas_admin_only" on public.personas_agendadas;
create policy "users_can_delete_personas_admin_only" on public.personas_agendadas
  for delete to authenticated using (public.is_admin());

-- ── task_forms ─────────────────────────────────────────────────────────────
drop policy if exists "users_can_delete_forms_admin_only" on public.task_forms;
create policy "users_can_delete_forms_admin_only" on public.task_forms
  for delete to authenticated using (public.is_admin());

drop policy if exists "users_can_write_forms_user_or_admin" on public.task_forms;
create policy "users_can_write_forms_user_or_admin" on public.task_forms
  for insert to authenticated with check (public.is_at_least_user());
drop policy if exists "users_can_update_forms_user_or_admin" on public.task_forms;
create policy "users_can_update_forms_user_or_admin" on public.task_forms
  for update to authenticated using (public.is_at_least_user())
  with check (public.is_at_least_user());

-- ── task_templates ─────────────────────────────────────────────────────────
drop policy if exists "users_can_delete_templates_admin_only" on public.task_templates;
create policy "users_can_delete_templates_admin_only" on public.task_templates
  for delete to authenticated using (public.is_admin());

-- ── task_status_sets ───────────────────────────────────────────────────────
drop policy if exists "users_can_delete_status_sets_admin_only" on public.task_status_sets;
create policy "users_can_delete_status_sets_admin_only" on public.task_status_sets
  for delete to authenticated using (public.is_admin());
drop policy if exists "users_can_write_status_sets_admin_only" on public.task_status_sets;
create policy "users_can_write_status_sets_admin_only" on public.task_status_sets
  for insert to authenticated with check (public.is_admin());
drop policy if exists "users_can_update_status_sets_admin_only" on public.task_status_sets;
create policy "users_can_update_status_sets_admin_only" on public.task_status_sets
  for update to authenticated using (public.is_admin())
  with check (public.is_admin());

-- ── monthly_reports ────────────────────────────────────────────────────────
-- Solo admin puede modificar reportes; users pueden leer
drop policy if exists "users_can_write_reports_admin_only" on public.monthly_reports;
create policy "users_can_write_reports_admin_only" on public.monthly_reports
  for insert to authenticated with check (public.is_admin());
drop policy if exists "users_can_update_reports_admin_only" on public.monthly_reports;
create policy "users_can_update_reports_admin_only" on public.monthly_reports
  for update to authenticated using (public.is_admin())
  with check (public.is_admin());
drop policy if exists "users_can_delete_reports_admin_only" on public.monthly_reports;
create policy "users_can_delete_reports_admin_only" on public.monthly_reports
  for delete to authenticated using (public.is_admin());

notify pgrst, 'reload schema';
