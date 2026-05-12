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

Inserta data ficticia identificable:

| Tabla              | Cantidad | Identificación |
|--------------------|----------|----------------|
| `monthly_reports`  | 12       | meses mayo 2025 → abril 2026, números con curva ascendente coherente |
| `tasks`            | 26       | titulo con prefijo `Demo - `, 5-6 por departamento |
| `personas_agendadas` | 12     | name con prefijo `Demo - ` (`John Doe`, `Acme Corp`, etc.) |
| `seguimientos`     | 8        | content con prefijo `Demo - ` |
| `profiles`         | 0        | **SKIPPED** — la tabla tiene FK a `auth.users`, crear users demo deja cuentas reales |

**Idempotencia**: correr 2 veces no duplica. `monthly_reports` hace upsert
sobre `month`. `tasks` y `personas_agendadas` borran lo previo identificado
por prefijo antes de insertar.

```bash
pnpm seed:demo
```

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

## Sobre profiles

El seed deliberadamente NO crea perfiles. La tabla `profiles` tiene FK a
`auth.users`, así que crear miembros de equipo demo requeriría crear
usuarios reales en Supabase Auth — esos podrían intentar loguearse y
generar ruido. Las tareas y personas usan emails ficticios como
`owner`/`assignees` (campos `text` sin FK), suficiente para que la UI
muestre datos coherentes en la demo.

Si necesitás perfiles reales:
1. Invitá manualmente desde `/admin/team` usando la UI.
2. O extendé `seed-demo-data.ts` para usar `db.auth.admin.createUser(...)`.

## Archivos

| Archivo                  | Rol |
|--------------------------|---|
| `_lib.ts`                | Helpers compartidos (env loader, service client, constantes) |
| `seed-demo-data.ts`      | Seed principal |
| `cleanup-demo-data.ts`   | Cleanup con confirmación |
