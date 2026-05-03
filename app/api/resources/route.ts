import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

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
  const { data, error } = await db
    .from("resources")
    .select("*")
    .order("category")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resources: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { title, url, description, category, type } = body

  if (!title?.trim() || !url?.trim()) {
    return NextResponse.json({ error: "Título y URL son requeridos" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("resources")
    .insert({
      title:       title.trim(),
      url:         url.trim(),
      description: description?.trim() || null,
      category:    category?.trim() || "General",
      type:        type || "link",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resource: data })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  // Supports both ?id=... and body { id }
  const { searchParams } = new URL(req.url)
  const idFromQuery = searchParams.get("id")
  let id = idFromQuery

  if (!id) {
    try { const body = await req.json(); id = body.id } catch {}
  }

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db.from("resources").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
