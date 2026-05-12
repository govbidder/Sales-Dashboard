import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdminOrAbove } from "@/lib/types/role"
import { getEffectiveUser } from "@/lib/auth/get-effective-user"

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

// GET /api/departments — list all departments ordered by sort_order
export async function GET(req: NextRequest) {
  const auth = await getEffectiveUser(req)
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from("departments")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ departments: data ?? [] })
}

// POST /api/departments — create a new department (admin only)
export async function POST(req: NextRequest) {
  const auth = await getEffectiveUser(req)
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (!isAdminOrAbove(auth.effectiveUser.role)) {
    return NextResponse.json({ error: "Solo admins pueden crear departamentos" }, { status: 403 })
  }

  const db = createServiceClient()
  const body = await req.json()
  const name = (body.name ?? "").trim()
  if (!name) return NextResponse.json({ error: "name requerido" }, { status: 400 })

  const insert: Record<string, unknown> = { name }
  if (body.description) insert.description = body.description.trim()
  if (body.color) {
    const color = body.color.trim()
    if (!HEX_COLOR_RE.test(color)) {
      return NextResponse.json({ error: "color debe ser HEX #RRGGBB" }, { status: 400 })
    }
    insert.color = color
  }
  if (typeof body.sort_order === "number") insert.sort_order = body.sort_order

  const { data, error } = await db
    .from("departments")
    .insert(insert)
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya existe un departamento con ese nombre" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ department: data }, { status: 201 })
}
