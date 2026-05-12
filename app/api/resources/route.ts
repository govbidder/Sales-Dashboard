import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { getEffectiveUser } from "@/lib/auth/get-effective-user"

export async function GET(req: NextRequest) {
  const auth = await getEffectiveUser(req); const user = auth?.effectiveUser ?? null
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
  const auth = await getEffectiveUser(req); const user = auth?.effectiveUser ?? null
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { title, url, description, category, type, content } = body

  // Solo el título es requerido. La URL es opcional — los SOPs son documentos
  // internos sin necesariamente un link externo. Para items tipo link/video/file
  // del centro operativo (recursos, accesos), el cliente sigue mandando URL.
  if (!title?.trim()) {
    return NextResponse.json({ error: "El título es requerido" }, { status: 400 })
  }

  const db = createServiceClient()
  const basePayload: Record<string, unknown> = {
    title:       title.trim(),
    url:         url?.trim() || "",
    description: description?.trim() || null,
    category:    category?.trim() || "General",
    type:        type || "link",
  }
  const cleanedContent = typeof content === "string" ? content.trim() : ""
  if (cleanedContent) basePayload.content = cleanedContent

  let { data, error } = await db.from("resources").insert(basePayload).select().single()

  // Fallback: si la migration que agrega `content` todavía no fue aplicada al
  // live DB, PostgREST tira "Could not find the 'content' column". En ese caso
  // re-intentamos sin content (perder el template inicial es preferible a no
  // poder crear el SOP). El user verá el SOP creado y podrá completar el
  // contenido cuando aplique la migration.
  if (error && /Could not find the 'content' column/i.test(error.message) && "content" in basePayload) {
    delete basePayload.content
    const retry = await db.from("resources").insert(basePayload).select().single()
    data = retry.data
    error = retry.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resource: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await getEffectiveUser(req); const user = auth?.effectiveUser ?? null
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { id, title, url, description, content, category, type } = body

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  // Solo seteamos los campos que vienen explícitamente en el body. Esto permite
  // updates parciales (ej. el modal de SOP guarda solo `content` y no debería
  // pisar `title`/`url`/`description` con valores stale).
  const patch: Record<string, unknown> = {}
  if (title       !== undefined) patch.title       = String(title).trim()
  if (url         !== undefined) patch.url         = url == null ? "" : String(url).trim()
  if (description !== undefined) patch.description = description == null ? null : String(description).trim() || null
  if (content     !== undefined) patch.content     = content == null ? null : String(content)
  if (category    !== undefined) patch.category    = String(category).trim()
  if (type        !== undefined) patch.type        = type

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("resources")
    .update(patch)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    // Mensaje legible cuando la migration de `content` aún no se aplicó.
    if (/Could not find the 'content' column/i.test(error.message)) {
      return NextResponse.json({
        error: "La columna `content` aún no existe en la base. Aplicá la migration `20260512000002_resources_content.sql` en el SQL editor de Supabase para habilitar el guardado de SOPs.",
      }, { status: 500 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ resource: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await getEffectiveUser(req); const user = auth?.effectiveUser ?? null
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
