/**
 * Helper de autenticación con soporte de impersonation segura.
 *
 * ⚠ ESTE ARCHIVO ES CRÍTICO PARA LA SEGURIDAD ⚠
 *
 * Reglas (NO modificar sin entender las implicancias):
 *   1. El JWT del header Authorization es la ÚNICA fuente de verdad
 *      sobre quién hace la request. No se confía en otros headers,
 *      cookies, ni state de cliente para determinar quién es developer.
 *   2. El rol REAL siempre se lee desde la DB con el user_id del JWT,
 *      vía service-role client (bypasea RLS para evitar loops).
 *   3. El header X-View-As-User-Id solo se respeta si el rol real
 *      es `developer`. Para cualquier otro rol → se IGNORA silenciosamente
 *      (no error, no log de warning).
 *   4. No se permite impersonate de otro `developer` (rol target = developer
 *      → ignorar header, procesar como real).
 *   5. Si el header tiene un user_id que no existe en profiles → ignorar
 *      silenciosamente.
 *   6. Cada request donde isImpersonating === true se loguea (fire-and-forget)
 *      en `impersonation_log` para audit trail.
 */

import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"
import { type Role } from "@/lib/types/role"

/** Header que el cliente envía cuando hay un user simulado activo. */
export const VIEW_AS_HEADER = "x-view-as-user-id"

export interface EffectiveUserInfo {
  id:            string
  email:         string | null
  role:          Role
  department_id: string | null
}

export interface AuthContext {
  /** Usuario REAL que firma el JWT. Usar SOLO para audit / logging. */
  realUser:        EffectiveUserInfo
  /** Usuario "efectivo" — el real, o el simulado si isImpersonating. */
  effectiveUser:   EffectiveUserInfo
  /** true si hay impersonation activa Y válida. */
  isImpersonating: boolean
}

/**
 * Resuelve el usuario "efectivo" para una request.
 *
 * Returns null si la auth falla (token inválido, sin profile asociado).
 * En cualquier otro caso devuelve { realUser, effectiveUser, isImpersonating }.
 *
 * Las routes deberían:
 *  - Usar `effectiveUser.role` para chequeos de permisos visuales/server-side.
 *  - Usar `effectiveUser.id` / `effectiveUser.email` para filtrar data
 *    "del usuario" (mis tareas, mis personas, etc).
 *  - Usar `realUser.id` solo para campos de audit (audit_log.actor).
 */
export async function getEffectiveUser(req: NextRequest): Promise<AuthContext | null> {
  // ─── 1) Validar JWT (única fuente de verdad para "quién es este caller") ─
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null

  const supabaseAnon = createClient()
  const { data: userResp, error: userErr } = await supabaseAnon.auth.getUser(token)
  if (userErr || !userResp?.user) return null

  const realAuthUser = userResp.user
  const db = createServiceClient()

  // ─── 2) Leer perfil REAL desde DB con service role (bypassea RLS) ────────
  const { data: realProfile } = await db
    .from("profiles")
    .select("id, role, department_id")
    .eq("id", realAuthUser.id)
    .single()

  if (!realProfile) return null

  const realUser: EffectiveUserInfo = {
    id:            realProfile.id,
    email:         realAuthUser.email ?? null,
    role:          realProfile.role as Role,
    department_id: (realProfile as { department_id?: string | null }).department_id ?? null,
  }

  // ─── 3) Leer header X-View-As-User-Id (puede estar o no) ─────────────────
  const viewAsUserId = req.headers.get(VIEW_AS_HEADER)?.trim() || null

  // CRITICAL GUARD: header solo se respeta si el rol REAL es developer.
  // Cualquier otro caso → ignorar silenciosamente.
  if (!viewAsUserId || realUser.role !== "developer") {
    return { realUser, effectiveUser: realUser, isImpersonating: false }
  }

  // ─── 4) Lookup del usuario simulado en DB ────────────────────────────────
  const { data: simulatedProfile } = await db
    .from("profiles")
    .select("id, role, department_id")
    .eq("id", viewAsUserId)
    .single()

  // Silenciar si no existe.
  if (!simulatedProfile) {
    return { realUser, effectiveUser: realUser, isImpersonating: false }
  }

  // CRITICAL GUARD: no se permite impersonate de otro developer.
  if (simulatedProfile.role === "developer") {
    return { realUser, effectiveUser: realUser, isImpersonating: false }
  }

  // ─── 5) Resolver email del simulado (vía auth admin — necesario para
  //         filtros owner/assignee que usan email como string). ────────────
  let simulatedEmail: string | null = null
  try {
    const { data: authResp } = await db.auth.admin.getUserById(simulatedProfile.id)
    simulatedEmail = authResp?.user?.email ?? null
  } catch { /* silent — si falla, email queda null y los filtros por email no matchean */ }

  const effectiveUser: EffectiveUserInfo = {
    id:            simulatedProfile.id,
    email:         simulatedEmail,
    role:          simulatedProfile.role as Role,
    department_id: (simulatedProfile as { department_id?: string | null }).department_id ?? null,
  }

  // ─── 6) Fire-and-forget al impersonation_log (audit trail) ──────────────
  const url = new URL(req.url)
  void db.from("impersonation_log").insert({
    real_user_id:         realUser.id,
    impersonated_user_id: effectiveUser.id,
    endpoint:             url.pathname,
    method:               req.method,
  }).then(() => undefined, () => undefined)

  return { realUser, effectiveUser, isImpersonating: true }
}
