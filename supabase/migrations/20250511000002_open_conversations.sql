-- =============================================
-- Add open_conversations (conversaciones abiertas) to monthly_reports.
--
-- KPI explícitamente solicitado por Cristian en el discovery (mayo 2026)
-- junto con scheduled_calls (ya existe) y cierres_por_offerdoc (ya existe).
-- =============================================

alter table public.monthly_reports
  add column if not exists open_conversations int;

comment on column public.monthly_reports.open_conversations is
  'Conversaciones de venta abiertas en el mes (KPI Cristian — discovery 2026-05).';

notify pgrst, 'reload schema';
