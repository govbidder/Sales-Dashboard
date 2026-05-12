-- =============================================
-- Role tiers: super_admin / admin / user (= empleado) / viewer
--
-- Estrategia ADITIVA: agregamos `super_admin` como tercer nivel ejecutivo,
-- por encima de `admin`. La función `is_admin()` retorna true tanto para
-- admin como para super_admin, así NINGUNA policy existente cambia.
--
-- Diferencia funcional: solo super_admin puede promover/degradar otros
-- usuarios a admin (gate aplicado en API, no en RLS — `profiles` ya tiene
-- policy "users_own_profile_update" que aplica solo al propio perfil).
--
-- Roles efectivos:
--   - super_admin: máxima autoridad, gestiona admins
--   - admin:       acceso completo operativo
--   - user:        empleado, scoping por departamento en UI
--   - viewer:      solo lectura (preexistente)
-- =============================================

-- 1. Update CHECK constraint to include super_admin.
do $$
begin
  alter table public.profiles drop constraint if exists profiles_role_check_v2;
  alter table public.profiles drop constraint if exists profiles_role_check_v3;
  alter table public.profiles
    add constraint profiles_role_check_v3
    check (role in ('super_admin', 'admin', 'user', 'viewer'));
end $$;

-- 2. is_admin() ahora incluye super_admin.
--    Las policies que ya usan is_admin() siguen funcionando sin cambios.
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  )
$$;

-- 3. is_super_admin() — para gates específicos (gestión de admins).
create or replace function public.is_super_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'super_admin'
  )
$$;

-- 4. is_at_least_user() — ahora super_admin también pasa.
create or replace function public.is_at_least_user() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin', 'admin', 'user')
  )
$$;

notify pgrst, 'reload schema';
