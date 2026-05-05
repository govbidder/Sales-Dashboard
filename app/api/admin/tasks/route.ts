import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

// GET /api/admin/tasks                       → all tasks
// GET /api/admin/tasks?persona_id=xxx        → tasks for a persona
// GET /api/admin/tasks?owner=foo             → tasks for a team member
// GET /api/admin/tasks?status=pendiente      → tasks by status
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const personaId = req.nextUrl.searchParams.get("persona_id")
  const owner     = req.nextUrl.searchParams.get("owner")
  const status    = req.nextUrl.searchParams.get("status")

  const db = createServiceClient()
  let query = db.from("tasks").select("*")

  if (personaId) query = query.eq("persona_id", personaId)
  if (owner)     query = query.eq("owner", owner)
  if (status)    query = query.eq("status", status)

  const { data, error } = await query
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  if (!body?.title?.trim()) {
    return NextResponse.json({ error: "title es requerido" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("tasks")
    .insert({
      title:       body.title.trim(),
      description: body.description?.trim() || null,
      status:      body.status   || "pendiente",
      priority:    body.priority || "media",
      owner:       body.owner?.trim()   || null,
      due_at:      body.due_at   || null,
      persona_id:  body.persona_id || null,
      created_by:  user.email || user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  // Auto-stamp completed_at when status flips to completada
  if (updates.status === "completada" && !updates.completed_at) {
    updates.completed_at = new Date().toISOString()
  } else if (updates.status && updates.status !== "completada") {
    updates.completed_at = null
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db.from("tasks").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
