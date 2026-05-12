-- ─────────────────────────────────────────────────────────────────────────────
-- Enable Supabase Realtime para tablas operativas
--
-- Supabase Realtime usa la publicación `supabase_realtime` para hacer
-- streaming de cambios vía Logical Replication. Por default solo tiene
-- algunas tablas; hay que agregar explícitamente las que querés que
-- sean realtime-aware.
--
-- Después de aplicar esto, el cliente puede suscribirse vía
-- supabase.channel("...").on("postgres_changes", {...}).subscribe()
-- y recibir INSERT / UPDATE / DELETE events.
--
-- REPLICA IDENTITY FULL: necesario para que los UPDATE/DELETE events
-- incluyan el row anterior completo (no solo PK). Esto permite resolver
-- conflictos optimistic-vs-server en el cliente.
--
-- ⚠️ NO APLICAR AUTOMÁTICAMENTE — correr manualmente en el SQL editor
--    de Supabase después de revisar.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tasks (kanban + lista)
alter publication supabase_realtime add table public.tasks;
alter table public.tasks replica identity full;

-- Personas Agendadas (pipeline)
alter publication supabase_realtime add table public.personas;
alter table public.personas replica identity full;

-- Monthly Reports (KPIs por mes)
alter publication supabase_realtime add table public.monthly_reports;
alter table public.monthly_reports replica identity full;
