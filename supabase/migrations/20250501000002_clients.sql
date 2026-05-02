-- Clients: top-level client/company records
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.clients enable row level security;

-- Admins can manage all clients
create policy "admin_all_clients" on public.clients
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Users can read their own client
create policy "users_read_own_client" on public.clients
  for select to authenticated
  using (id in (select client_id from public.profiles where id = auth.uid()));

-- Service role has full access
create policy "service_role_all_clients_top" on public.clients
  for all to service_role using (true) with check (true);

-- Add foreign key from profiles.client_id -> clients.id
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'profiles_client_id_fkey'
      and table_name = 'profiles'
  ) then
    alter table public.profiles
      add constraint profiles_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete set null;
  end if;
end $$;

notify pgrst, 'reload schema';
