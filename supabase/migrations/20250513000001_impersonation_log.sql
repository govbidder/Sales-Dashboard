-- =============================================
-- Impersonation log — audit trail server-side de cada request donde
-- un developer impersona a otro usuario vía header X-View-As-User-Id.
--
-- Lo escribe `getEffectiveUser` (server) cuando isImpersonating === true.
-- Lectura restringida a super_admin + developer (a través de RLS).
-- =============================================

create table if not exists public.impersonation_log (
  id                    uuid primary key default gen_random_uuid(),
  real_user_id          uuid not null references public.profiles(id) on delete cascade,
  impersonated_user_id  uuid not null references public.profiles(id) on delete cascade,
  endpoint              text not null,
  method                text not null,
  created_at            timestamptz not null default now()
);

create index if not exists idx_impersonation_log_real_user
  on public.impersonation_log(real_user_id);
create index if not exists idx_impersonation_log_created
  on public.impersonation_log(created_at desc);

alter table public.impersonation_log enable row level security;

drop policy if exists "impersonation_log_select_oversight" on public.impersonation_log;

-- SELECT: super_admin Y developer pueden leer (oversight).
create policy "impersonation_log_select_oversight"
  on public.impersonation_log for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'developer')
    )
  );

-- Sin policies de INSERT/UPDATE/DELETE — solo service role escribe.

notify pgrst, 'reload schema';
