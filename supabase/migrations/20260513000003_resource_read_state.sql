-- =============================================
-- resource_read_state: cada user marca SOPs como leídos. Sincroniza entre
-- dispositivos. Si el SOP se edita después, vuelve a "no leído" (lógica
-- Notion/Slack) — eso se computa en el cliente comparando read_at con el
-- updated_at del resource.
-- =============================================

create table if not exists public.resource_read_state (
  user_id     uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  read_at     timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create index if not exists idx_resource_read_state_user
  on public.resource_read_state(user_id);

alter table public.resource_read_state enable row level security;

drop policy if exists "service_role_all_read_state" on public.resource_read_state;
create policy "service_role_all_read_state" on public.resource_read_state
  for all to service_role using (true) with check (true);

drop policy if exists "users_own_read_state" on public.resource_read_state;
create policy "users_own_read_state" on public.resource_read_state
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
