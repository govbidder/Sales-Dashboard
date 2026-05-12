# Scripts — GovBidder Dashboard

Scripts auxiliares para seed y cleanup de data de demo.

## ⚠ Advertencia

**NO correr en producción con data real existente.**

Estos scripts asumen que estás en un entorno con DB limpia o de staging.
Si tu DB tiene reportes reales en los meses cubiertos por el seed
(mayo 2025 → abril 2026), el seed los **sobrescribirá** y el cleanup
los **borrará**. Hacé backup antes de cualquier corrida en prod.

## Pre-requisitos

- Node 20+ (probado en 22.11).
- `pnpm install` ejecutado (instala `tsx` que es lo que corre los `.ts`).
- `.env.local` (o `.env`) en el root con:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

El script lee las variables desde `.env.local` con prioridad sobre `.env`.

## Scripts disponibles

### `pnpm seed:demo` — llenar con data demo

Inserta data ficticia "grande" identificable (presentación-ready):

| Tabla              | Cantidad | Identificación |
|--------------------|----------|----------------|
| `monthly_reports`  | 12       | meses mayo 2025 → abril 2026, curva ascendente realista (revenue 8k→25k, scheduled_calls 30→80, etc.) |
| `profiles` + `auth.users` | 20 | 1 super_admin + 2 admins (sin depto) + 5 leads + 12 miembros distribuidos en los 5 deptos |
| `tasks`            | 60       | 12 por departamento — mix de status, priority, due dates (pasado/futuro), tags relevantes, owners rotativos |
| `personas_agendadas` | 30     | Mix de call_status (atendida/no_show/agendada/reagendada) y sales_status (cerrada/propuesta/pendiente/perdida) |
| `seguimientos`     | 25       | Mix de tipos (nota/llamada/mensaje/email/reunion), unos completos otros pendientes |

**Idempotencia**: correr 2 veces no duplica. `monthly_reports` hace upsert
sobre `month`. `profiles` hace upsert sobre `id` y resetea el password si
cambió. `tasks` y `personas_agendadas` borran lo previo identificado
por prefijo antes de insertar.

```bash
pnpm seed:demo
```

### Credenciales demo

Los 20 usuarios se crean con un **password compartido**:

```
Password: DemoGovBidder2026!
```

**Admins** (sin depto, vista completa cross-empresa):

| Email                                       | Nombre               | Rol           |
|---------------------------------------------|----------------------|---------------|
| demo-cristobal@govbidder-demo.com           | Cristóbal Mendoza    | super_admin   |
| demo-diana@govbidder-demo.com               | Diana Ruiz           | admin         |
| demo-marcelo@govbidder-demo.com             | Marcelo Fontana      | admin         |

**Empleados por departamento** (rol `user`, scoping al propio depto):

| Email                                       | Nombre               | Depto         |
|---------------------------------------------|----------------------|---------------|
| demo-ana@govbidder-demo.com                 | Ana García (Lead)    | IA            |
| demo-diego@govbidder-demo.com               | Diego Vásquez        | IA            |
| demo-camila@govbidder-demo.com              | Camila Pérez         | IA            |
| demo-luis@govbidder-demo.com                | Luis Pérez (Lead)    | Marketing     |
| demo-florencia@govbidder-demo.com           | Florencia Vega       | Marketing     |
| demo-tomas@govbidder-demo.com               | Tomás Sosa           | Marketing     |
| demo-sofia@govbidder-demo.com               | Sofía Ramírez (Lead) | Anuncios      |
| demo-hugo@govbidder-demo.com                | Hugo Cabrera         | Anuncios      |
| demo-valentina@govbidder-demo.com           | Valentina Ortega     | Anuncios      |
| demo-mateo@govbidder-demo.com               | Mateo Salas          | Anuncios      |
| demo-marcos@govbidder-demo.com              | Marcos López (Lead)  | Orgánico      |
| demo-bianca@govbidder-demo.com              | Bianca Aguirre       | Orgánico      |
| demo-renata@govbidder-demo.com              | Renata Espina        | Orgánico      |
| demo-elena@govbidder-demo.com               | Elena Castro (Lead)  | Lanzamientos  |
| demo-joaquin@govbidder-demo.com             | Joaquín Méndez       | Lanzamientos  |
| demo-lucia@govbidder-demo.com               | Lucía Romero         | Lanzamientos  |
| demo-ivan@govbidder-demo.com                | Iván Torres          | Lanzamientos  |

Útil para la presentación: logueate como `demo-cristobal` (super_admin) y mostrá la vista cross-empresa; después como `demo-ana` (user/empleado) para ver el scoping del sidebar y de las tasks al depto IA.

### `pnpm cleanup:demo` — borrar TODA la data demo

Pide confirmación interactiva (escribir `yes`). Borra:

- `monthly_reports` con `month` en el rango seedeado.
- `tasks` con `title LIKE 'Demo - %'`.
- `personas_agendadas` con `name LIKE 'Demo - %'` (cascade a seguimientos).
- `seguimientos` con `content LIKE 'Demo - %'`.
- `auth users` con email tipo `demo-*@govbidder-demo.com` (cascade a profiles).

```bash
pnpm cleanup:demo
```

## Sobre profiles + auth users

El seed crea **20 usuarios reales en Supabase Auth** con la misma contraseña
compartida (ver tablas de credenciales arriba). Cada uno tiene su perfil con
`full_name`, `position`, `department_id` y un rol acorde:
- 1 `super_admin` (vista completa + manage admins)
- 2 `admin` (vista completa, sin manage super_admins)
- 17 `user` (5 leads + 12 miembros, scoping por depto)

⚠ **Estos usuarios pueden loguearse.** Considerá:
- El dominio `@govbidder-demo.com` es ficticio (no recibe emails reales).
- Todos los emails son fácilmente identificables por prefijo `demo-`.
- `pnpm cleanup:demo` borra los `auth.users` (cascade a profiles) cuando
  termina la presentación.
- Si querés rotar el password después del demo, cambialo en
  `scripts/_lib.ts` y volvé a correr `pnpm seed:demo` — el seed
  actualiza la contraseña por idempotencia (también resetea metadata).

### Sobre `status` y `position`

El seed setea `status: "activo"` y `position` en best-effort. Si la
migración `20250504000004_team_profiles.sql` no está aplicada (o
PostgREST tiene cache stale), se ignora silenciosamente — el resto del
seed sigue funcionando con los campos base (id / full_name / role /
department_id).

### `pnpm promote:developer <email>` — promover a developer

Promueve un usuario existente al rol `developer` (máximo nivel jerárquico,
arriba de super_admin). Pensado para el owner del repo / testing interno.

```bash
pnpm promote:developer juampiacosta158@gmail.com
```

Reglas:
- El usuario tiene que existir previamente en `auth.users` (signup hecho).
- Solo se espera UN developer. Si ya hay otro, el script avisa y NO procede.
- Para forzar (agregar un segundo): agregar `--force`.
- Para demotar manualmente: SQL directo:
  ```sql
  update public.profiles set role = 'admin' where role = 'developer';
  ```

El rol `developer` pasa todos los gates de admin / super_admin. NO es
asignable desde la UI bajo ninguna circunstancia — solo este script.

## Archivos

| Archivo                       | Rol |
|-------------------------------|---|
| `_lib.ts`                     | Helpers compartidos (env loader, service client, constantes) |
| `seed-demo-data.ts`           | Seed principal |
| `cleanup-demo-data.ts`        | Cleanup con confirmación |
| `promote-to-developer.ts`     | Promover usuario a rol developer (máximo nivel) |
