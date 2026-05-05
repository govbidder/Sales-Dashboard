import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

// GET /api/admin/seguimientos?persona_id=xxx → list for a persona
// GET /api/admin/seguimientos                 → all seguimientos
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const personaId = req.nextUrl.searchParams.get("persona_id")
  const db = createServiceClient()
  let query = db
    .from("seguimientos")
    .select("*")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (personaId) query = query.eq("persona_id", personaId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ seguimientos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const db = createServiceClient()
  const { data, error } = await db
    .from("seguimientos")
    .insert({
      persona_id: body.persona_id || null,
      type:       body.type || "nota",
      content:    body.content?.trim() || null,
      completed:  body.completed ?? false,
      owner:      body.owner?.trim() || null,
      due_at:     body.due_at || null,
      completed_at: body.completed ? (body.completed_at || new Date().toISOString()) : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ seguimiento: data })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  // Auto-stamp completed_at when toggling to completed
  if ("completed" in updates) {
    updates.completed_at = updates.completed ? new Date().toISOString() : null
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("seguimientos")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ seguimiento: data })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db.from("seguimientos").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
