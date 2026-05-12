import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { getEffectiveUser } from "@/lib/auth/get-effective-user"
import { isSuperAdminOrAbove } from "@/lib/types/role"

/**
 * GET /api/admin/impersonation-log
 * Devuelve entries del impersonation_log enriquecidos con info de los
 * usuarios involucrados. Solo super_admin o developer pueden leer.
 *
 * NOTA: validamos contra el rol REAL (no effective). Si un developer
 * está simulando un user empleado, NO debería poder leer este log
 * desde la vista simulada.
 */
export async function GET(req: NextRequest) {
  const auth = await getEffectiveUser(req)
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  // CRITICAL: chequear contra REAL role, no effective.
  if (!isSuperAdminOrAbove(auth.realUser.role)) {
    return NextResponse.json({ error: "Solo super_admin/developer" }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 1000)

  const db = createServiceClient()
  const { data: logs, error } = await db
    .from("impersonation_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ entries: [], unavailable: true, error: error.message })
  }

  // Enriquecer con email + nombre de cada user involucrado.
  const ids = new Set<string>()
  for (const l of (logs ?? [])) {
    ids.add(l.real_user_id)
    ids.add(l.impersonated_user_id)
  }
  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name")
    .in("id", Array.from(ids))
  const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]))

  const { data: authResp } = await db.auth.admin.listUsers({ perPage: 200 })
  const emailById = new Map((authResp?.users ?? []).map(u => [u.id, u.email ?? null]))

  const entries = (logs ?? []).map((l: any) => ({
    id:                     l.id,
    real_user_id:           l.real_user_id,
    real_user_name:         profileById.get(l.real_user_id)?.full_name ?? null,
    real_user_email:        emailById.get(l.real_user_id) ?? null,
    impersonated_user_id:   l.impersonated_user_id,
    impersonated_user_name: profileById.get(l.impersonated_user_id)?.full_name ?? null,
    impersonated_user_email:emailById.get(l.impersonated_user_id) ?? null,
    endpoint:               l.endpoint,
    method:                 l.method,
    created_at:             l.created_at,
  }))

  return NextResponse.json({ entries })
}
