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

// GET /api/admin/team — list all team members (profiles enriched with auth data)
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()

  const [profilesRes, authRes] = await Promise.all([
    db.from("profiles").select("*"),
    db.auth.admin.listUsers({ perPage: 200 }),
  ])

  if (profilesRes.error) {
    return NextResponse.json({ error: profilesRes.error.message }, { status: 500 })
  }

  const profiles = profilesRes.data ?? []
  const authUsers = authRes.data?.users ?? []
  const authById = new Map(authUsers.map(u => [u.id, u]))

  // Optional: include counts of personas owned + tasks assigned.
  const [personasRes, tasksRes] = await Promise.all([
    db.from("personas_agendadas").select("owner"),
    db.from("tasks").select("owner, assignees"),
  ])

  const personasCount = new Map<string, number>()
  for (const p of personasRes.data ?? []) {
    if (p.owner) personasCount.set(p.owner, (personasCount.get(p.owner) ?? 0) + 1)
  }

  const tasksCount = new Map<string, number>()
  for (const t of tasksRes.data ?? []) {
    const all = new Set<string>()
    if (t.owner) all.add(t.owner)
    for (const a of (t.assignees ?? [])) all.add(a)
    for (const k of all) tasksCount.set(k, (tasksCount.get(k) ?? 0) + 1)
  }

  const members = profiles.map(p => {
    const auth = authById.get(p.id)
    const email = auth?.email ?? null
    return {
      id:               p.id,
      email,
      full_name:        p.full_name ?? null,
      role:             p.role ?? "user",
      position:         (p as any).position ?? null,
      status:           (p as any).status ?? "activo",
      started_at:       (p as any).started_at ?? null,
      avatar_url:       (p as any).avatar_url ?? null,
      notes:            (p as any).notes ?? null,
      department_id:    (p as any).department_id ?? null,
      last_sign_in_at:  auth?.last_sign_in_at ?? null,
      created_at:       p.created_at,
      personas_owned:   email ? (personasCount.get(email) ?? 0) : 0,
      tasks_assigned:   email ? (tasksCount.get(email)    ?? 0) : 0,
    }
  })

  return NextResponse.json({ members })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const db = createServiceClient()

  // Verify caller is admin or above; only super_admin can change role to/from super_admin.
  const { data: callerProfile } = await db
    .from("profiles").select("role").eq("id", user.id).single()
  const callerRole = callerProfile?.role as Role | undefined
  if (!isAdminOrAbove(callerRole)) {
    return NextResponse.json({ error: "Solo admins pueden modificar miembros" }, { status: 403 })
  }

  // Developer profile no se gestiona desde la UI bajo NINGUNA circunstancia.
  // Para tocarlo, usar service role directo (scripts/promote-to-developer.ts).
  const { data: target } = await db.from("profiles").select("role").eq("id", id).single()
  if (target?.role === "developer") {
    return NextResponse.json({ error: "El rol developer solo se gestiona vía script" }, { status: 403 })
  }

  if ("role" in updates) {
    // `developer` no es asignable desde la UI — solo super_admin/admin/user/viewer.
    const validRoles: Role[] = ["super_admin", "admin", "user", "viewer"]
    if (!validRoles.includes(updates.role)) {
      return NextResponse.json({ error: "Rol inválido o no asignable desde la UI" }, { status: 400 })
    }
    // super_admin solo lo puede asignar super_admin o developer.
    if (updates.role === "super_admin" && !isSuperAdminOrAbove(callerRole)) {
      return NextResponse.json({ error: "Solo super_admin o developer puede asignar super_admin" }, { status: 403 })
    }
    // No demotar a un super_admin si no sos super_admin o developer.
    if (target?.role === "super_admin" && !isSuperAdminOrAbove(callerRole)) {
      return NextResponse.json({ error: "Solo super_admin o developer puede modificar otro super_admin" }, { status: 403 })
    }
  }

  const allowed: Record<string, unknown> = {}
  for (const k of ["full_name", "role", "position", "status", "started_at", "avatar_url", "notes", "department_id"]) {
    if (k in updates) allowed[k] = updates[k]
  }

  const { data, error } = await db
    .from("profiles")
    .update(allowed)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data })
}
