-- Rename typo column: aplications → applications.
--
-- Originalmente la columna se creó en 20250501000003_monthly_reports.sql
-- con typo ("aplications" sin doble p). Esto resincroniza el nombre con la
-- forma correcta en inglés.
--
-- ⚠️ NO APLICAR AUTOMÁTICAMENTE — aplicar manualmente en Supabase Dashboard
--    después de revisar y haber deployado el código que usa el nombre nuevo.
--    El código en este PR usa "applications" (sin typo); si se aplica antes
--    del deploy, las APIs van a romper.
--
-- Si esta migración ya quedó atrás en algún ambiente, no hace falta repetirla.

ALTER TABLE monthly_reports
  RENAME COLUMN aplications TO applications;
