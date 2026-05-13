# Auth Setup — GovBidder

Checklist de config requerida en Supabase + Vercel para que los flows de auth
(login, signup, invite, forgot/reset password) funcionen sin fricción.

Si llegás acá porque algo del auth está roto, recorrer esta lista resuelve
el 95% de los casos. Los códigos de error en consola (con prefijo
`[auth:flow] code: ...`) te dicen exactamente cuál de estos puntos falla.

---

## 1. Variables de entorno

| Variable | Dónde | Valor | Requerida |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | `https://xxx.supabase.co` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API Keys → anon public | `sb_publishable_...` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys → service_role | `eyJ...` | ✅ (server-only) |
| `NEXT_PUBLIC_APP_URL` | Vercel → Settings → Env Variables | `https://<tu-dominio>` (sin trailing slash) | ⚠️ Recomendado |

**Sobre `NEXT_PUBLIC_APP_URL`**: el código de invite y forgot-password lo
prioriza para armar el `redirectTo` del email. Sin esto, intenta resolver
con el `Origin` header / `window.location.origin`, que en dev puede ser
`localhost:3000` (y entonces el invitado recibe un link a localhost).

---

## 2. Supabase Dashboard → Authentication → URL Configuration

### Site URL
El URL "canónico" del proyecto. Supabase lo usa como fallback cuando un
endpoint de auth no recibe `redirectTo` explícito.

- **Valor**: `https://<tu-dominio-prod>` (ej. `https://sales-dashboard-zeta-rose.vercel.app`)
- **NO usar `localhost`** (rompe los emails de invite y password reset
  cuando alguien los recibe en producción).

### Additional Redirect URLs
Lista blanca de URLs a las que Supabase permite redirigir desde un magic link
o invite. Si un URL no está acá, el email puede llegar pero el click resulta
en error `redirect_to is not allowed`.

Agregar (uno por línea):

```
https://<tu-dominio-prod>/reset-password
https://<tu-dominio-prod>/login
https://<tu-dominio-prod>/**
http://localhost:3000/reset-password
http://localhost:3000/login
http://localhost:3000/**
```

> Tip: el patrón `/**` permite cualquier path bajo ese host. Útil mientras
> el set de rutas autenticadas todavía cambia. Para producción más estricta,
> listar solo las rutas exactas.

---

## 3. Email Templates (Authentication → Email Templates)

Cada template usa `{{ .ConfirmationURL }}` que Supabase arma combinando el
`redirectTo` que pasamos desde el código con un token de un solo uso. Si los
templates están en estado "default", no hace falta tocarlos para que funcione.

Para customización de marca, tocar:
- Confirm signup
- Invite user
- Reset password

---

## 4. SMTP (Authentication → Email Settings)

Supabase incluye un SMTP gratuito **muy restrictivo**:
- 4 emails por hora por proyecto (compartido con otros usuarios del free tier)
- Solo emails a la dirección del owner del proyecto en algunos planes

**Para producción real, configurar SMTP propio**. Opciones recomendadas:

### Resend (más simple)
1. Crear cuenta en https://resend.com
2. Verificar el dominio (Settings → Domains → Add)
3. En Supabase → Authentication → Email Settings → Enable Custom SMTP, completar:
   - Host: `smtp.resend.com`
   - Port: `465`
   - User: `resend`
   - Password: tu API key (sin el prefijo `re_`)
   - Sender email: `noreply@<tu-dominio>`
   - Sender name: `GovBidder`

### Otras opciones
- Postmark
- SendGrid
- Mailgun
- Cualquier SMTP estándar (Gmail SMTP no se recomienda, baja deliverability)

### Sin custom SMTP
Vas a hitear el rate limit muy rápido en cuanto invites a más de 2-3 personas.
Los errores aparecerán como `over_email_send_rate_limit` en consola.

---

## 5. Verificar end-to-end

Una vez configurado todo:

1. **Login**: abrir `/login`, ingresar mal el password → debe decir
   *"Email o contraseña incorrectos..."* (no el raw `Invalid login credentials`).
2. **Forgot password**: abrir `/forgot-password`, mandar un email → debe llegar
   con un link que arranca con `https://<tu-dominio>/reset-password#access_token=...`.
3. **Reset password** (haciendo click en el link del paso 2): la página debe
   mostrar el form de nueva contraseña, no un error 500.
4. **Invite** (desde `/admin/team`): el email debe llegar con un link al
   dominio correcto, NO a `localhost:3000`.

Si algo falla, **abrir la consola del browser** y buscar logs con prefijo
`[auth:...]`. Te van a decir exactamente qué código de error devolvió
Supabase y a qué pertenece.

---

## 6. Códigos de error comunes (cheat sheet)

| Código | Qué significa | Cómo arreglar |
|---|---|---|
| `invalid_credentials` | Login con email/password incorrectos | El user se equivocó. UX OK. |
| `email_not_confirmed` | Login antes de validar el email | El user tiene que abrir el email de confirmación. |
| `rate_limit` | Demasiadas requests en poco tiempo | Esperar 1 min, o configurar SMTP custom (sección 4). |
| `already_registered` | Signup con email existente | UX correcta — sugerir login o reset. |
| `link_expired` | Magic link de reset/invite ya usado | Pedir uno nuevo. Si pasa siempre, revisar SMTP (sección 4). |
| `redirect_not_allowed` | Redirect URL fuera de la allow-list | Agregar URL en sección 2. |
| `smtp_error` | SMTP roto o no configurado | Configurar custom SMTP (sección 4). |
| `unknown` | Cualquier otra cosa | Mirar `[auth:...]` en consola y el raw message. |
