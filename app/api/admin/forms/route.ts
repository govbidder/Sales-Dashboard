import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

// GET — list all forms with submission counts
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from("task_forms")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ forms: data ?? [] })
}

// POST — create a new form
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }

  if (!body.slug || !body.title) {
    return NextResponse.json({ error: "Faltan slug y title" }, { status: 400 })
  }
  // Slug validation: lowercase letters, numbers, hyphens
  if (!/^[a-z0-9-]+$/.test(body.slug)) {
    return NextResponse.json({ error: "Slug solo puede tener letras minúsculas, números y guiones" }, { status: 400 })
  }

  const db = createServiceClient()

  // Check uniqueness
  const { data: existing } = await db.from("task_forms").select("id").eq("slug", body.slug).maybeSingle()
  if (existing) {
    return NextResponse.json({ error: `Ya existe un form con slug "${body.slug}"` }, { status: 409 })
  }

  const { data, error } = await db
    .from("task_forms")
    .insert({
      slug:               body.slug,
      title:              body.title,
      description:        body.description ?? null,
      fields:             body.fields ?? [],
      default_priority:   body.default_priority   ?? "media",
      default_tags:       body.default_tags       ?? [],
      default_assignees:  body.default_assignees  ?? [],
      is_active:          body.is_active ?? true,
      created_by:         user.email ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ form: data })
}

// PATCH — update an existing form
export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  // Slug validation if changed
  if (updates.slug && !/^[a-z0-9-]+$/.test(updates.slug)) {
    return NextResponse.json({ error: "Slug solo puede tener letras minúsculas, números y guiones" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("task_forms")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ form: data })
}

// DELETE — remove a form (cascades to submissions)
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const db = createServiceClient()
  const { data: before } = await db.from("task_forms").select("slug,title,submit_count").eq("id", id).maybeSingle()

  const { error } = await db.from("task_forms").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { audit } = await import("@/lib/audit")
  await audit(req, {
    actor:     user.email ?? null,
    action:    "form.delete",
    entity:    "task_form",
    entity_id: id,
    payload:   { before },
  })

  return NextResponse.json({ ok: true })
}
