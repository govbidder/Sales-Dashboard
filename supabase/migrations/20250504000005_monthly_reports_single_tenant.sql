-- ─────────────────────────────────────────────────────────────────────────────
-- Make monthly_reports single-tenant: one row per month for the whole company.
-- - Drop the (client_id, month) compound unique
-- - Add unique (month) so each month maps to one report
-- - client_id stays nullable for legacy compat; will be ignored going forward
-- ─────────────────────────────────────────────────────────────────────────────

-- Try to drop the old unique constraint by name, fallback to common pg name
do $$
begin
  perform 1
  from   pg_constraint
  where  conname = 'monthly_reports_client_id_month_key';
  if found then
    execute 'alter table public.monthly_reports drop constraint monthly_reports_client_id_month_key';
  end if;

  -- Defensive: also try the unnamed pattern Postgres might have generated
  perform 1
  from   pg_constraint c
  join   pg_class t on t.oid = c.conrelid
  where  t.relname = 'monthly_reports'
    and  c.contype = 'u'
    and  array_length(c.conkey, 1) = 2;
  if found then
    execute (
      select 'alter table public.monthly_reports drop constraint ' || quote_ident(conname)
      from   pg_constraint c
      join   pg_class t on t.oid = c.conrelid
      where  t.relname = 'monthly_reports'
        and  c.contype = 'u'
        and  array_length(c.conkey, 1) = 2
      limit 1
    );
  end if;
end $$;

-- Add the new unique
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'monthly_reports_month_unique'
  ) then
    execute 'alter table public.monthly_reports add constraint monthly_reports_month_unique unique (month)';
  end if;
end $$;

-- Replace existing RLS policies to drop client_id-scoped logic
drop policy if exists "users_own_client_monthly_reports" on public.monthly_reports;

drop policy if exists "authenticated_all_monthly_reports" on public.monthly_reports;
create policy "authenticated_all_monthly_reports" on public.monthly_reports
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
