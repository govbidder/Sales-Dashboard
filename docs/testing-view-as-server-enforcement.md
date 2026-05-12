# Testing View-As — server-side enforcement (Milestone 4)

Casos de prueba manual para verificar que la simulación cliente (View-As)
es respetada por el server cuando corresponde, y **ignorada silenciosamente**
en cualquier otro escenario.

## Pre-requisitos

- Migrations aplicadas hasta `20250513000001_impersonation_log.sql` inclusive.
- `pnpm seed:demo` corrido — 20 usuarios demo + 60 tasks + departments.
- Juampi (owner) promovido a developer con `pnpm promote:developer`.
- Disponibilidad de `curl` y un browser con devtools.

## Cómo obtener un access token para curl

```js
// En la consola del browser, logueado:
const { data } = await window.__supabase?.auth.getSession()
copy(data.session.access_token)
```
(Si no hay `window.__supabase`, en otra page del dashboard abrir devtools
y agarrar el header `Authorization` de cualquier request al `/api/admin/*`.)

---

## Casos POSITIVOS (el server debe respetar el header)

### Caso 1 — Developer simulando empleado: GET /api/admin/tasks filtra al depto

**Setup**: logueado como `juampiacosta158@gmail.com` (developer real). View-As → "Ana García" (empleada IA).

**Acción**:
```bash
curl -H "Authorization: Bearer $TOKEN_DEVELOPER" \
     -H "X-View-As-User-Id: $ANA_USER_ID" \
     https://<host>/api/admin/tasks
```

**Esperado**:
- `tasks` solo contiene tareas donde Ana es owner/assignee, o que están en
  el depto IA.
- NO devuelve tareas de Marketing/Anuncios/etc (a menos que Ana sea
  assignee de alguna).

**Verificación adicional**: en Supabase, `select count(*) from impersonation_log`
debe haber incrementado en 1.

### Caso 2 — Developer simulando empleado: PATCH a admin endpoint se rechaza

**Acción**:
```bash
curl -X PATCH \
     -H "Authorization: Bearer $TOKEN_DEVELOPER" \
     -H "X-View-As-User-Id: $ANA_USER_ID" \
     -H "Content-Type: application/json" \
     -d '{"id":"some-id","role":"admin"}' \
     https://<host>/api/admin/team
```

**Esperado**: 403 — "Solo admins pueden modificar miembros". Porque Ana es
`user`, no admin, y el server enforce el rol effective.

### Caso 3 — Developer SIN view-as: pasa por todos los gates

**Acción**: misma request sin el header `X-View-As-User-Id`.

**Esperado**: la operación procede normalmente (200/OK) porque developer
pasa todos los gates de admin/super_admin.

### Caso 4 — Developer simulando otro developer: header se IGNORA

**Acción**: armar request con `X-View-As-User-Id: <otro-developer-id>` (si
hubiera dos developers, lo cual el spec prohíbe). Por la guarda
"no impersonate de otro developer", el server debería ignorar.

**Esperado**: la request se procesa como si NO hubiera header — el developer
real conserva sus permisos.

---

## Casos NEGATIVOS (CRÍTICOS de seguridad — header DEBE ser ignorado)

### Caso 5 — User normal envía header X-View-As-User-Id falso

**Setup**: logueado como `demo-ana@govbidder-demo.com` (rol = user).

**Acción**:
```bash
curl -H "Authorization: Bearer $TOKEN_ANA" \
     -H "X-View-As-User-Id: $CRISTOBAL_SUPER_ADMIN_ID" \
     https://<host>/api/admin/tasks
```

**Esperado**:
- 200 OK pero con la respuesta correspondiente a **Ana**, no a Cristóbal.
- Ana sigue viendo solo sus tareas y las de IA — el header fue ignorado.
- NO debe haber entry en `impersonation_log`.

### Caso 6 — User normal trata de impersonate vía header desde browser devtools

Mismo que Caso 5 pero modificando localStorage manualmente:
```js
localStorage.setItem("viewAsUser", JSON.stringify({ id: "<super-admin-id>" }))
```

**Esperado**: idéntico al Caso 5. `fetchWithViewAs` agrega el header pero
el server lo descarta porque el JWT de Ana no corresponde a un developer.

### Caso 7 — Admin (no developer) trata de impersonate

**Setup**: logueado como `demo-cristobal@govbidder-demo.com` (rol = super_admin).

**Acción**: enviar header `X-View-As-User-Id` con id de Ana.

**Esperado**: header IGNORADO. Cristóbal sigue siendo Cristóbal en el
server. NO se loguea como impersonation.

### Caso 8 — Service role key + header X-View-As

**Setup**: alguien con acceso a la service role key intenta usarla.

**Acción**: request directa a `/api/admin/tasks` con `Authorization: Bearer <service-role-jwt>` + `X-View-As-User-Id: <any>`.

**Esperado**: `supabase.auth.getUser(serviceRoleToken)` no devuelve un user
válido (service role no tiene `sub`/user_id), entonces `getEffectiveUser`
retorna null → 401.

### Caso 9 — Header con UUID inválido o user_id inexistente

**Acción**: developer envía `X-View-As-User-Id: 00000000-0000-0000-0000-000000000000`.

**Esperado**: el lookup en profiles falla, el header es ignorado
silenciosamente. La request procede como si el developer no estuviera
simulando.

### Caso 10 — UI vs server: developer simulando, ve task de otro depto

**Setup**: developer simula a Ana. Server devuelve solo tareas que Ana
puede ver. Si el developer (vía UI hack) abre el panel de detalle de una
tarea de otro depto (ej: del cache local), el PATCH debería fallar.

**Acción**: PATCH de una task que NO es del depto de Ana.

**Esperado**: el server permite el PATCH (la API tasks PATCH no chequea
"el caller puede tocar esta task" hoy), pero la tarea NO aparecerá en la
lista que se devuelve después porque el GET filtra.

**Nota**: este caso muestra que el server enforce es **scoping de
lectura**, no **scoping de escritura granular por entidad**. La protección
contra escrituras maliciosas sigue dependiendo de RLS + admin gates.

---

## Verificación de UI

### En el browser

1. Login como developer.
2. Click 👁 → simular "Ana García".
3. Banner amber arriba con "Viendo como Ana García".
4. Ir a `/admin/tasks` — kanban con solo tareas de IA + asignadas a Ana.
5. Ir a `/inicio` — widget Departamentos con IA destacada, otras dimadas.
   El widget recibe SOLO tasks de IA del server (no las cuenta de los otros).
6. Click en card "Marketing" → /admin/tasks?department=marketing-id —
   la lista debe estar vacía (server filtró).
7. Ir a `/admin/audit-log` → tab "Impersonations" — debe verse cada
   request que se hizo mientras se simulaba.
8. "Volver a Developer" → todo vuelve.

### En la DB

```sql
-- Ver las últimas impersonations:
select * from public.impersonation_log
order by created_at desc
limit 20;

-- Counts por usuario impersonado:
select
  impersonated_user_id,
  count(*) as requests,
  min(created_at) as first_seen,
  max(created_at) as last_seen
from public.impersonation_log
group by impersonated_user_id
order by requests desc;
```

---

## Archivos críticos para revisar

Estos archivos contienen lógica de seguridad central — revisar cualquier
cambio futuro con cuidado:

| Archivo | Por qué crítico |
|---|---|
| [lib/auth/get-effective-user.ts](../lib/auth/get-effective-user.ts) | **Toda** la lógica de validación + impersonation guards. Un bug acá = vulnerabilidad |
| [supabase/migrations/20250513000001_impersonation_log.sql](../supabase/migrations/20250513000001_impersonation_log.sql) | RLS del log — solo super_admin/developer pueden leer |
| [app/api/admin/impersonation-log/route.ts](../app/api/admin/impersonation-log/route.ts) | Doble check en endpoint: solo super_admin/developer (vía REAL role) |
| [lib/api/fetch-with-view-as.ts](../lib/api/fetch-with-view-as.ts) | Cliente que agrega el header. Si esto tiene un bug, podrías estar enviando headers indebidos pero el server los ignoraría igual |
