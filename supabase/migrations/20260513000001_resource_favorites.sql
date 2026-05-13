-- =============================================
-- resource_favorites: cada usuario puede marcar resources como favoritos.
--
-- Cubre SOPs principalmente pero queda generic (cualquier categoría puede
-- favoritearse). Sincroniza entre dispositivos.
-- =============================================

create table if not exists public.resource_favorites (
  user_id     uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create index if not exists idx_resource_favorites_user
  on public.resource_favorites(user_id);

alter table public.resource_favorites enable row level security;

-- Service role passes through (los API routes usan service client).
drop policy if exists "service_role_all_resource_favorites" on public.resource_favorites;
create policy "service_role_all_resource_favorites" on public.resource_favorites
  for all to service_role using (true) with check (true);

-- Cada user puede CRUD solo sus propios favoritos (defensa adicional por si
-- alguien usa el anon client directamente).
drop policy if exists "users_own_favorites" on public.resource_favorites;
create policy "users_own_favorites" on public.resource_favorites
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
