-- =============================================
-- resources: agrega columna `department_id` (uuid, nullable) para agrupar
-- SOPs (y otros recursos) por departamento.
--
-- Filas:
--  - department_id IS NULL → recurso global / sin área asignada.
--  - department_id IS NOT NULL → pertenece a ese departamento.
--
-- En la UI del centro operativo, las secciones de SOPs se filtran por este
-- campo. Recursos/Accesos quedan globales (department_id null).
-- =============================================

alter table public.resources
  add column if not exists department_id uuid
  references public.departments(id) on delete set null;

create index if not exists idx_resources_department
  on public.resources(department_id);

notify pgrst, 'reload schema';
