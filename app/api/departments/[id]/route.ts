import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

async function requireAdmin(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return { error: "No autorizado", status: 401, user: null }

  const db = createServiceClient()
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return { error: "Solo admins pueden modificar departamentos", status: 403, user: null }
  }

  return { error: null, status: 0, user }
}

// PATCH /api/departments/[id] — update a department (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params

  const body = await req.json()
  const allowed: Record<string, unknown> = {}
  for (const k of ["name", "description", "color", "sort_order"]) {
    if (k in body) allowed[k] = typeof body[k] === "string" ? body[k].trim() : body[k]
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("departments")
    .update(allowed)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ department: data })
}

// DELETE /api/departments/[id] — delete a department (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params

  const db = createServiceClient()
  const { error } = await db
    .from("departments")
    .delete()
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
