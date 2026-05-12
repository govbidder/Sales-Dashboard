import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdminOrAbove, isSuperAdminOrAbove, type Role } from "@/lib/types/role"
import { getEffectiveUser } from "@/lib/auth/get-effective-user"

function safeOrigin(maybeUrl: string): string | null {
  try { return new URL(maybeUrl).origin } catch { return null }
}

// POST /api/admin/team/invite — invite a new team member by email
// Only admins can invite.
export async function POST(req: NextRequest) {
  const auth = await getEffectiveUser(req)
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const callerRole = auth.effectiveUser.role

  if (!isAdminOrAbove(callerRole)) {
    return NextResponse.json({ error: "Solo admins pueden invitar al equipo" }, { status: 403 })
  }

  const db = createServiceClient()

  const body = await req.json()
  const email    = body?.email?.trim()
  const fullName = body?.full_name?.trim() || null
  const position = body?.position?.trim() || null
  const requestedRole = body?.role as Role | undefined
  // `developer` NUNCA es asignable desde la UI; solo desde scripts.
  const validRoles: Role[] = ["super_admin", "admin", "user", "viewer"]
  let role: Role = validRoles.includes(requestedRole as Role) ? (requestedRole as Role) : "user"
  // super_admin solo lo puede asignar super_admin o developer.
  if (role === "super_admin" && !isSuperAdminOrAbove(callerRole)) {
    return NextResponse.json({ error: "Solo super_admin o developer puede crear otro super_admin" }, { status: 403 })
  }
  const departmentId = body?.department_id || null

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email válido requerido" }, { status: 400 })
  }

  // Redirect explícito al flow de set-password. Si no pasamos `redirectTo`,
  // Supabase usa el "Site URL" del dashboard que suele estar mal configurado
  // (apunta a localhost en dev) → el invitado recibe un link a localhost
  // que no existe en su browser. Tomamos el origin de la request misma para
  // que el link funcione tanto en dev como en producción sin tocar config.
  // Prioridad: env override (NEXT_PUBLIC_APP_URL) > Origin header > Referer.
  const originHeader = req.headers.get("origin")
  const refererHeader = req.headers.get("referer")
  const refererOrigin = refererHeader ? safeOrigin(refererHeader) : null
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    originHeader ||
    refererOrigin ||
    "" // empty → Supabase fallback a Site URL del dashboard
  const redirectTo = baseUrl ? `${baseUrl.replace(/\/$/, "")}/reset-password` : undefined

  // Send invite via Supabase Auth admin
  const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role },
    redirectTo,
  })

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  // Profile is auto-created by the on_auth_user_created trigger.
  // Backfill the role/full_name/position if not set.
  if (invited.user) {
    await db
      .from("profiles")
      .upsert({
        id:            invited.user.id,
        full_name:     fullName,
        role,
        position,
        department_id: departmentId,
        status:        "activo",
      } as any, { onConflict: "id" })
  }

  return NextResponse.json({ user: invited.user })
}
