-- =============================================
-- Add `developer` role — máximo nivel jerárquico.
--
-- Jerarquía resultante (de mayor a menor):
--   developer > super_admin > admin > user > viewer
--
-- - is_admin() ahora retorna true también para developer (así TODAS las
--   policies y rutas que gatean por "admin or above" siguen funcionando
--   sin cambios). Es aditivo, no rompe nada.
-- - is_developer() — nuevo helper para gates específicos del rol más alto.
-- - Solo UN usuario (owner del repo) tiene este rol; se asigna vía
--   scripts/promote-to-developer.ts (service role), NO desde la UI.
-- =============================================

-- 1. Extender CHECK constraint para incluir 'developer'.
do $$
begin
  alter table public.profiles drop constraint if exists profiles_role_check_v2;
  alter table public.profiles drop constraint if exists profiles_role_check_v3;
  alter table public.profiles drop constraint if exists profiles_role_check_v4;
  alter table public.profiles
    add constraint profiles_role_check_v4
    check (role in ('developer', 'super_admin', 'admin', 'user', 'viewer'));
end $$;

-- 2. is_admin() ahora incluye developer.
--    Las policies que ya usan is_admin() siguen funcionando sin cambios —
--    developer pasa todos los gates de admin/super_admin existentes.
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin', 'developer')
  )
$$;

-- 3. is_developer() — gate exclusivo para developer (testing/impersonation).
create or replace function public.is_developer() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'developer'
  )
$$;

-- 4. is_at_least_user() — ahora developer también pasa.
create or replace function public.is_at_least_user() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('developer', 'super_admin', 'admin', 'user')
  )
$$;

notify pgrst, 'reload schema';
