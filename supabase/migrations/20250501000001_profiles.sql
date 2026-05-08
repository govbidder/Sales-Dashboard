-- Profiles: extends auth.users with role and client assignment
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'user',   -- 'admin' | 'user'
  full_name   text,
  client_id   uuid,                           -- links user to a client record
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read/update their own profile
create policy "users_own_profile_select" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "users_own_profile_update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Admins can read all profiles.
-- IMPORTANTE: usar una función security-definer para evitar recursión infinita.
-- Si la policy hiciera `exists (select from profiles ...)` directo, la sub-query
-- volvería a fire la policy → loop. La función bypasea RLS.
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create policy "admin_read_all_profiles" on public.profiles
  for select to authenticated
  using (public.is_admin());

-- Service role has full access
create policy "service_role_all_profiles" on public.profiles
  for all to service_role using (true) with check (true);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

notify pgrst, 'reload schema';
