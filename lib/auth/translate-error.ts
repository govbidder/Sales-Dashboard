/**
 * Traduce errores de Supabase Auth a mensajes humanos en español.
 *
 * Por qué existe:
 *  - Los errores raw de Supabase vienen en inglés y son técnicos
 *    ("Invalid login credentials", "Email link is invalid or has expired").
 *  - Antes el código a veces ENMASCARABA el error real con un mensaje
 *    genérico ("No pudimos enviar el email...") que escondía la causa.
 *    Eso hacía imposible debuggear y daba mala UX.
 *  - Acá centralizamos la traducción y SIEMPRE loggeamos el error
 *    original a consola para que un admin pueda ver qué pasó.
 *
 * Uso:
 *   const { message, code } = translateAuthError(error, { context: "forgot-password" })
 *   setErr(message)
 */

interface TranslateOptions {
  /** Para qué flow se está usando — afecta algunas heurísticas. */
  context?: "login" | "signup" | "forgot-password" | "reset-password" | "invite"
  /** Si true, se loggea a console.error con prefijo. Default true. */
  log?: boolean
}

export interface TranslatedError {
  /** Mensaje humanizado en español, listo para mostrar al usuario. */
  message: string
  /** Código corto que el frontend puede usar para decisiones (ej. "rate_limit"). */
  code: string
  /** Mensaje raw original — útil para mostrar en un detail/aside técnico si se quiere. */
  rawMessage: string
}

const KNOWN_PATTERNS: Array<{
  test: (raw: string, code: string) => boolean
  code: string
  msg: (ctx: TranslateOptions["context"]) => string
}> = [
  // ─── Login / credentials ─────────────────────────────────────────────────
  {
    test: (raw, code) => code === "invalid_credentials" || /invalid login credentials/i.test(raw),
    code: "invalid_credentials",
    msg: () => "Email o contraseña incorrectos. Verificá los datos e intentá de nuevo.",
  },
  {
    test: (raw, code) => code === "email_not_confirmed" || /email not confirmed/i.test(raw),
    code: "email_not_confirmed",
    msg: () => "Tu cuenta todavía no fue confirmada. Revisá tu inbox (y spam) para validar el email.",
  },
  {
    test: (raw, code) => code === "user_not_found" || /user not found/i.test(raw),
    code: "user_not_found",
    msg: () => "No encontramos una cuenta con ese email.",
  },

  // ─── Rate limit ──────────────────────────────────────────────────────────
  {
    test: (raw, code) =>
      code === "over_email_send_rate_limit" ||
      code === "over_request_rate_limit" ||
      /rate limit/i.test(raw) ||
      /you can only request this once every/i.test(raw),
    code: "rate_limit",
    msg: () => "Demasiados intentos en poco tiempo. Esperá un minuto antes de reintentar.",
  },

  // ─── Signup ──────────────────────────────────────────────────────────────
  {
    test: (raw, code) =>
      ["user_already_exists", "email_exists", "email_already_exists"].includes(code) ||
      /already\s*(registered|in\s*use)|user\s*already\s*registered/i.test(raw),
    code: "already_registered",
    msg: () => "Ya existe una cuenta con ese email. Probá iniciar sesión o resetear la contraseña.",
  },
  {
    test: (raw, code) => code === "weak_password" || /password.*(too short|weak)/i.test(raw),
    code: "weak_password",
    msg: () => "La contraseña es muy débil. Usá al menos 6 caracteres (mejor 8+).",
  },
  {
    test: (raw, code) => code === "signup_disabled" || /signups? (are )?disabled/i.test(raw),
    code: "signup_disabled",
    msg: () => "El registro está deshabilitado en este momento. Pedile a un admin que te invite.",
  },

  // ─── Reset password / magic link ─────────────────────────────────────────
  {
    test: (raw, code) => code === "otp_expired" || /token has expired|link.*(invalid|expired)/i.test(raw),
    code: "link_expired",
    msg: () => "El link expiró o ya fue usado. Pedí uno nuevo y abrilo apenas llegue al email.",
  },
  {
    test: (raw, code) => code === "access_denied" || /access denied/i.test(raw),
    code: "access_denied",
    msg: () => "Acceso denegado. Pedí un nuevo link y abrilo desde la misma pestaña apenas llegue.",
  },

  // ─── Config / infra ──────────────────────────────────────────────────────
  {
    test: (raw) =>
      /redirect_to|redirect url|not allowed for this/i.test(raw) ||
      /invalid.+url/i.test(raw),
    code: "redirect_not_allowed",
    msg: () =>
      "El dominio de la app no está autorizado en Supabase. Avisale al admin: tiene que agregar la URL en Authentication → URL Configuration → Redirect URLs.",
  },
  {
    test: (raw, code) =>
      code === "smtp_error" ||
      /smtp|email service|email provider|sending.*email/i.test(raw),
    code: "smtp_error",
    msg: () =>
      "El servicio de envío de emails no está disponible. Avisale al admin: el SMTP del proyecto Supabase necesita revisión.",
  },
  {
    test: (raw, code) => code === "database_error" || /database error/i.test(raw),
    code: "database_error",
    msg: () => "Tuvimos un problema interno guardando los datos. Intentá de nuevo en un momento.",
  },

  // ─── Network ─────────────────────────────────────────────────────────────
  {
    test: (raw) => /failed to fetch|networkerror|network request failed/i.test(raw),
    code: "network",
    msg: () => "No pude conectar con el servidor. Verificá tu conexión a internet e intentá de nuevo.",
  },
]

export function translateAuthError(error: unknown, opts: TranslateOptions = {}): TranslatedError {
  const { context, log = true } = opts

  // Defensive: aceptar string, Error, o Supabase AuthError.
  const raw =
    typeof error === "string"
      ? error
      : (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string"
          ? (error as any).message
          : String(error ?? ""))

  const code = (error && typeof error === "object" && "code" in error ? String((error as any).code ?? "") : "").trim()

  // Match contra patrones conocidos.
  for (const p of KNOWN_PATTERNS) {
    if (p.test(raw, code)) {
      const message = p.msg(context)
      if (log) console.error(`[auth:${context ?? "?"}] ${p.code}:`, raw, error)
      return { message, code: p.code, rawMessage: raw }
    }
  }

  // Fallback: surface el mensaje raw + log. Mejor que esconderlo — al menos
  // un admin puede ver qué pasó.
  if (log) console.error(`[auth:${context ?? "?"}] unknown error:`, raw, error)
  return {
    message: raw || "Ocurrió un error inesperado. Si persiste, contactá al admin.",
    code: code || "unknown",
    rawMessage: raw,
  }
}
