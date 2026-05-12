import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdminOrAbove, isSuperAdminOrAbove, type Role } from "@/lib/types/role"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

// POST /api/admin/team/invite — invite a new team member by email
// Only admins can invite.
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()

  // Verify caller is admin
  const { data: callerProfile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const callerRole = callerProfile?.role as Role | undefined
  if (!isAdminOrAbove(callerRole)) {
    return NextResponse.json({ error: "Solo admins pueden invitar al equipo" }, { status: 403 })
  }

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

  // Send invite via Supabase Auth admin
  const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role },
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
