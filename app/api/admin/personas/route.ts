import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdminOrAbove, type Role } from "@/lib/types/role"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()

  // Scoping para empleados: ven sólo las personas que tienen asignadas (owner = email).
  // Admins y super_admin ven todo.
  const { data: callerProfile } = await db
    .from("profiles").select("role").eq("id", user.id).single()
  const callerRole = (callerProfile?.role as Role | undefined) ?? "user"

  let query = db
    .from("personas_agendadas")
    .select("*")
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (!isAdminOrAbove(callerRole)) {
    query = query.eq("owner", user.email ?? "")
  }

  const { data, error } = await query

  if (error) {
    console.error("[admin/personas GET]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ personas: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "name es requerido" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("personas_agendadas")
    .insert({
      name:         body.name.trim(),
      email:        body.email?.trim() || null,
      phone:        body.phone?.trim() || null,
      instagram:    body.instagram?.trim() || null,
      scheduled_at: body.scheduled_at || null,
      call_status:  body.call_status  || "agendada",
      sales_status: body.sales_status || "pendiente",
      owner:        body.owner?.trim()  || null,
      source:       body.source?.trim() || null,
      rating:       body.rating ?? null,
      notes:        body.notes?.trim()  || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ persona: data })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db
    .from("personas_agendadas")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ persona: data })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db.from("personas_agendadas").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
