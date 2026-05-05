-- ─────────────────────────────────────────────────────────────────────────────
-- Team management: extend profiles with position/status/started_at + avatar.
-- The dashboard uses profiles as the team roster; auth.users provides email.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists position    text,
  add column if not exists status      text not null default 'activo',  -- activo | inactivo
  add column if not exists started_at  date,
  add column if not exists avatar_url  text,
  add column if not exists notes       text;

create index if not exists idx_profiles_status on public.profiles(status);

-- All authenticated team members can read all profiles (the team roster).
-- Admins can update anyone; users can only update their own (existing policy).
drop policy if exists "authenticated_read_all_profiles" on public.profiles;
create policy "authenticated_read_all_profiles" on public.profiles
  for select to authenticated using (true);

drop policy if exists "admin_update_all_profiles" on public.profiles;
create policy "admin_update_all_profiles" on public.profiles
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

notify pgrst, 'reload schema';
