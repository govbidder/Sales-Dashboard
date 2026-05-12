-- =============================================
-- Departments: entidad para organizar tareas y equipo
--
-- Depende de `public.is_admin()` (ver hotfix-profiles-recursion.sql).
-- La aseguramos abajo para que la migración sea autocontenida y se pueda
-- correr en cualquier orden / en una DB fresca.
-- =============================================

-- 0. Ensure is_admin() exists (idempotente).
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
$$;

-- 1. Tabla departments
create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  color       text not null default '#3b82f6'
              check (color ~* '^#[0-9a-f]{6}$'),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- 2. Seed inicial
insert into public.departments (name, color, sort_order) values
  ('IA',            '#8b5cf6', 1),
  ('Marketing',     '#f59e0b', 2),
  ('Anuncios',      '#ef4444', 3),
  ('Orgánico',      '#22c55e', 4),
  ('Lanzamientos',  '#3b82f6', 5)
on conflict (name) do nothing;

-- 3. FK en tasks
alter table public.tasks
  add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists idx_tasks_department_id on public.tasks(department_id);

-- 4. FK en profiles
alter table public.profiles
  add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists idx_profiles_department_id on public.profiles(department_id);

-- 5. RLS
alter table public.departments enable row level security;

drop policy if exists "departments_select_authenticated" on public.departments;
drop policy if exists "departments_insert_admin"         on public.departments;
drop policy if exists "departments_update_admin"         on public.departments;
drop policy if exists "departments_delete_admin"         on public.departments;

-- Todos los authenticated pueden leer
create policy "departments_select_authenticated"
  on public.departments for select
  to authenticated
  using (true);

-- Solo admins pueden insertar
create policy "departments_insert_admin"
  on public.departments for insert
  to authenticated
  with check (public.is_admin());

-- Solo admins pueden actualizar
create policy "departments_update_admin"
  on public.departments for update
  to authenticated
  using (public.is_admin());

-- Solo admins pueden eliminar
create policy "departments_delete_admin"
  on public.departments for delete
  to authenticated
  using (public.is_admin());

notify pgrst, 'reload schema';
