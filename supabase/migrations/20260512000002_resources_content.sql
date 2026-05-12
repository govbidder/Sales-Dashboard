-- =============================================
-- resources: agrega columna `content` (text, nullable) y hace `url` opcional.
--
-- Motivación:
--  - SOPs (sop-sistemas, sop-operativos) son documentos internos con contenido
--    largo que vive en la app; no siempre tienen una URL externa.
--  - El modal de edición de SOPs ya intentaba persistir `content` vía PATCH
--    pero la columna no existía → guardar nunca funcionó.
--  - URLs vacíos rompían el NOT NULL constraint. Para SOPs `url=""` es válido.
-- =============================================

alter table public.resources
  add column if not exists content text;

-- Hacer `url` opcional con default "". Las filas existentes con url ya tienen
-- valor; las nuevas (SOPs sin link externo) pueden omitirlo.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'resources'
      and column_name  = 'url'
      and is_nullable  = 'NO'
  ) then
    alter table public.resources alter column url drop not null;
    alter table public.resources alter column url set default '';
  end if;
end $$;

notify pgrst, 'reload schema';
