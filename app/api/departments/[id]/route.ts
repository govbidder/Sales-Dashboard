import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdminOrAbove } from "@/lib/types/role"
import { getEffectiveUser } from "@/lib/auth/get-effective-user"

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

async function requireAdmin(req: NextRequest) {
  const auth = await getEffectiveUser(req)
  if (!auth) return { error: "No autorizado", status: 401 }
  if (!isAdminOrAbove(auth.effectiveUser.role)) {
    return { error: "Solo admins pueden modificar departamentos", status: 403 }
  }
  return { error: null, status: 0 }
}

// PATCH /api/departments/[id] — update a department (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin(req)
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { id } = await params

  const body = await req.json()
  const allowed: Record<string, unknown> = {}
  for (const k of ["name", "description", "color", "sort_order"]) {
    if (k in body) allowed[k] = typeof body[k] === "string" ? body[k].trim() : body[k]
  }

  if (typeof allowed.color === "string" && !HEX_COLOR_RE.test(allowed.color)) {
    return NextResponse.json({ error: "color debe ser HEX #RRGGBB" }, { status: 400 })
  }
  if (typeof allowed.name === "string" && !allowed.name) {
    return NextResponse.json({ error: "name no puede estar vacío" }, { status: 400 })
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

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya existe un departamento con ese nombre" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ department: data })
}

// DELETE /api/departments/[id] — delete a department (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin(req)
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { id } = await params

  const db = createServiceClient()
  const { error } = await db
    .from("departments")
    .delete()
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
