-- ═══════════════════════════════════════════════════════════════════════════
-- HOTFIX: Recursión infinita en policy "admin_read_all_profiles"
--
-- La policy original consulta `profiles` desde una policy de `profiles`,
-- causando: "infinite recursion detected in policy for relation 'profiles'"
--
-- Solución: usar una function `security definer` que bypasea RLS para el
-- check de admin. La función NO genera recursión porque su query no fire
-- las policies de profiles.
--
-- Pegá esto en Supabase Dashboard → SQL Editor → Run.
-- Es idempotente — se puede correr varias veces.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Asegurar que la función helper existe (security definer = bypasea RLS).
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
$$;

-- 2) Reemplazar la policy buggy.
drop policy if exists "admin_read_all_profiles" on public.profiles;

create policy "admin_read_all_profiles" on public.profiles
  for select to authenticated
  using (public.is_admin());

-- 3) Refresh schema.
notify pgrst, 'reload schema';

-- ─── Verificación rápida ─────────────────────────────────────────────────────
-- Después de correr, esto NO debería fallar:
--   select count(*) from public.profiles;
-- ═══════════════════════════════════════════════════════════════════════════
