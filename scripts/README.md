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
| `profiles` + `auth.users` | 5 | emails `demo-*@govbidder-demo.com`, rol `user` (empleado), uno por departamento |
| `tasks`            | 26       | titulo con prefijo `Demo - `, 5-6 por departamento |
| `personas_agendadas` | 12     | name con prefijo `Demo - ` (`John Doe`, `Acme Corp`, etc.) |
| `seguimientos`     | 8        | content con prefijo `Demo - ` |

**Idempotencia**: correr 2 veces no duplica. `monthly_reports` hace upsert
sobre `month`. `profiles` hace upsert sobre `id` y resetea el password si
cambió. `tasks` y `personas_agendadas` borran lo previo identificado
por prefijo antes de insertar.

```bash
pnpm seed:demo
```

### Credenciales demo

Los 5 usuarios se crean con un **password compartido**:

```
Password: DemoGovBidder2026!
```

Emails:

| Email                                  | Nombre         | Departamento  |
|----------------------------------------|----------------|---------------|
| demo-ana@govbidder-demo.com            | Ana García     | IA            |
| demo-luis@govbidder-demo.com           | Luis Pérez     | Marketing     |
| demo-sofia@govbidder-demo.com          | Sofía Ramírez  | Anuncios      |
| demo-marcos@govbidder-demo.com         | Marcos López   | Orgánico      |
| demo-elena@govbidder-demo.com          | Elena Castro   | Lanzamientos  |

Todos con rol `user` (empleado) — útil para mostrar en la presentación
la diferencia visual entre la vista admin (Cristián/Santo/Gabriela) y
la vista empleado (sidebar reducido, scoping de tareas al propio depto).

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

El seed crea **5 usuarios reales en Supabase Auth** con la misma contraseña
compartida (ver tabla de credenciales arriba). Cada uno tiene su perfil
con `full_name`, `position`, `department_id` y rol `user` (empleado).

⚠ **Estos usuarios pueden loguearse.** Considerá:
- El dominio `@govbidder-demo.com` es ficticio (no recibe emails reales).
- Los 5 emails son fácilmente identificables por prefijo `demo-`.
- `pnpm cleanup:demo` borra los `auth.users` (cascade a profiles) cuando
  termina la presentación.
- Si querés rotar el password después del demo, cambialo en
  `scripts/_lib.ts` y volvé a correr `pnpm seed:demo` — el seed
  actualiza la contraseña por idempotencia.

Si en algún momento querés crear un admin de demo (vs estos empleados),
ajustá `role: "admin"` en la llamada `auth.admin.createUser` y en el
upsert de profile en `seed-demo-data.ts`.

## Archivos

| Archivo                  | Rol |
|--------------------------|---|
| `_lib.ts`                | Helpers compartidos (env loader, service client, constantes) |
| `seed-demo-data.ts`      | Seed principal |
| `cleanup-demo-data.ts`   | Cleanup con confirmación |
