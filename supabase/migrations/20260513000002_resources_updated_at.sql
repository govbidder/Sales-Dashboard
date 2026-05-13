-- =============================================
-- resources: agrega `updated_at` + trigger que se actualiza on UPDATE.
--
-- Habilita el indicador "Actualizado hace Xd" en el centro operativo y
-- ordenar SOPs por última edición para que los modificados recientemente
-- queden arriba.
-- =============================================

alter table public.resources
  add column if not exists updated_at timestamptz;

-- Backfill: filas viejas sin updated_at toman su created_at como baseline.
update public.resources set updated_at = created_at where updated_at is null;

-- Default para futuras inserts que no especifiquen updated_at explícito.
alter table public.resources
  alter column updated_at set default now();

-- Reusamos la función set_updated_at() ya definida globalmente (schema.sql
-- la crea para monthly_reports). Si por alguna razón no existe, la creamos
-- defensivamente.
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    create or replace function public.set_updated_at()
    returns trigger language plpgsql as $f$
    begin new.updated_at = now(); return new; end;
    $f$;
  end if;
end $$;

drop trigger if exists trg_resources_updated_at on public.resources;
create trigger trg_resources_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
