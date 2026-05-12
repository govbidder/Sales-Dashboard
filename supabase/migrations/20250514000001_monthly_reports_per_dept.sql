-- =============================================
-- monthly_reports per-department: agrega `department_id` (nullable).
--
-- Filas:
--  - department_id IS NULL → reporte GLOBAL de empresa (una sola fila por mes).
--  - department_id IS NOT NULL → reporte específico del depto (una fila por
--    (mes, depto)).
--
-- El UNIQUE viejo (`month`) se reemplaza por dos índices únicos parciales que
-- garantizan ambas reglas.
--
-- Las filas existentes quedan como GLOBAL (department_id = NULL) — backwards
-- compatible. La app puede empezar a crear filas con department_id cuando
-- quiera, sin romper nada.
-- =============================================

-- 1. Agregar columna department_id (nullable).
alter table public.monthly_reports
  add column if not exists department_id uuid
  references public.departments(id) on delete cascade;

create index if not exists idx_monthly_reports_department
  on public.monthly_reports(department_id);

-- 2. Drop el UNIQUE viejo sobre `month` solo (si existe).
--    Nombres posibles según la migration que lo creó.
do $$
begin
  if exists (select 1 from pg_constraint
             where conname = 'monthly_reports_month_unique'
               and conrelid = 'public.monthly_reports'::regclass) then
    alter table public.monthly_reports drop constraint monthly_reports_month_unique;
  end if;

  -- Defensa contra constraints sin nombre creados por declaración inline
  -- en la migration original. Buscamos el nombre auto-generado.
  perform 1
  from   pg_constraint c
  join   pg_class t on t.oid = c.conrelid
  where  t.relname = 'monthly_reports'
    and  c.contype = 'u'
    and  pg_get_constraintdef(c.oid) ~ 'UNIQUE \(month\)'
  limit 1;
  if found then
    execute (
      select 'alter table public.monthly_reports drop constraint ' || c.conname
      from   pg_constraint c
      join   pg_class t on t.oid = c.conrelid
      where  t.relname = 'monthly_reports'
        and  c.contype = 'u'
        and  pg_get_constraintdef(c.oid) ~ 'UNIQUE \(month\)'
      limit 1
    );
  end if;

  -- Drop también el unique index si quedó suelto (compat con migrations viejas).
  if exists (select 1 from pg_indexes
             where indexname = 'monthly_reports_month_unique'
               and schemaname = 'public') then
    drop index public.monthly_reports_month_unique;
  end if;
end $$;

-- 3. Nuevos índices únicos parciales:
--    a) Una sola fila global por mes (department_id IS NULL).
create unique index if not exists monthly_reports_global_unique
  on public.monthly_reports(month)
  where department_id IS NULL;

--    b) Una sola fila por (mes, depto) cuando department_id IS NOT NULL.
create unique index if not exists monthly_reports_dept_unique
  on public.monthly_reports(month, department_id)
  where department_id IS NOT NULL;

notify pgrst, 'reload schema';
