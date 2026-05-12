import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { getEffectiveUser } from "@/lib/auth/get-effective-user"
import { canModifyResource, resolveCreateResource } from "@/lib/auth/can-modify-resource"
import { isAdminOrAbove } from "@/lib/types/role"

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
  const { title, url, description, category, type, content, department_id } = body

  // Solo el título es requerido. La URL es opcional — los SOPs son documentos
  // internos sin necesariamente un link externo. Para items tipo link/video/file
  // del centro operativo (recursos, accesos), el cliente sigue mandando URL.
  if (!title?.trim()) {
    return NextResponse.json({ error: "El título es requerido" }, { status: 400 })
  }

  // Gate de permisos: ¿este usuario puede crear este tipo de resource? Si es
  // un user normal creando un SOP, forzamos el department_id al suyo (el
  // helper normaliza el intento del cliente — no se confía en lo que mandó).
  const decision = resolveCreateResource(user.role, user.department_id, {
    category:      category?.trim() || null,
    department_id: department_id ?? null,
  })
  if (!decision.allowed) {
    return NextResponse.json({ error: decision.reason }, { status: 403 })
  }

  const db = createServiceClient()
  const basePayload: Record<string, unknown> = {
    title:         title.trim(),
    url:           url?.trim() || "",
    description:   description?.trim() || null,
    category:      category?.trim() || "General",
    type:          type || "link",
    department_id: decision.departmentId,
  }
  const cleanedContent = typeof content === "string" ? content.trim() : ""
  if (cleanedContent) basePayload.content = cleanedContent

  let { data, error } = await db.from("resources").insert(basePayload).select().single()

  // Fallback: si las migrations que agregan `content` / `department_id` todavía
  // no se aplicaron al live DB, PostgREST tira "Could not find the 'X' column".
  // Re-intentamos sin esa columna en cada caso — perder un campo opcional es
  // preferible a no poder crear el SOP.
  while (error) {
    const match = /Could not find the '(\w+)' column/i.exec(error.message)
    if (!match) break
    const missing = match[1]
    if (!(missing in basePayload)) break
    delete basePayload[missing]
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
  const { id, title, url, description, content, category, type, department_id } = body

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const db = createServiceClient()

  // Gate de permisos: cargar el resource y validar que el caller puede modificarlo.
  const { data: existing, error: loadErr } = await db
    .from("resources")
    .select("id, category, department_id")
    .eq("id", id)
    .single()
  if (loadErr || !existing) {
    return NextResponse.json({ error: "Recurso no encontrado" }, { status: 404 })
  }
  if (!canModifyResource(user.role, user.department_id, {
    category:      (existing as any).category ?? null,
    department_id: (existing as any).department_id ?? null,
  })) {
    return NextResponse.json({
      error: "No tenés permisos para editar este recurso. Solo admin o miembros del mismo departamento pueden hacerlo.",
    }, { status: 403 })
  }

  // Solo seteamos los campos que vienen explícitamente en el body. Esto permite
  // updates parciales (ej. el modal de SOP guarda solo `content` y no debería
  // pisar `title`/`url`/`description` con valores stale).
  const patch: Record<string, unknown> = {}
  if (title         !== undefined) patch.title         = String(title).trim()
  if (url           !== undefined) patch.url           = url == null ? "" : String(url).trim()
  if (description   !== undefined) patch.description   = description == null ? null : String(description).trim() || null
  if (content       !== undefined) patch.content       = content == null ? null : String(content)
  if (category      !== undefined) patch.category      = String(category).trim()
  if (type          !== undefined) patch.type          = type
  if (department_id !== undefined) {
    // Para users no-admin que intentan reasignar a otro depto: bloqueamos
    // el cambio. Solo admin+ puede mover un SOP entre departamentos.
    if (!isAdminOrAbove(user.role) && (department_id || null) !== ((existing as any).department_id || null)) {
      return NextResponse.json({
        error: "No podés cambiar el departamento de un recurso ajeno. Pedile a un admin.",
      }, { status: 403 })
    }
    patch.department_id = department_id || null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 })
  }
  let { data, error } = await db
    .from("resources")
    .update(patch)
    .eq("id", id)
    .select()
    .single()

  // Fallback: si una columna opcional aún no fue migrada, re-intentamos sin
  // ella. Si es `content` (la columna crítica del modal de SOPs) devolvemos
  // un mensaje legible — sin esa columna el guardado del SOP no tiene sentido.
  while (error) {
    const match = /Could not find the '(\w+)' column/i.exec(error.message)
    if (!match) break
    const missing = match[1]
    if (missing === "content") {
      return NextResponse.json({
        error: "La columna `content` aún no existe en la base. Aplicá la migration `20260512000002_resources_content.sql` en el SQL editor de Supabase para habilitar el guardado de SOPs.",
      }, { status: 500 })
    }
    if (!(missing in patch)) break
    delete patch[missing]
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Ninguna columna válida para actualizar" }, { status: 500 })
    }
    const retry = await db.from("resources").update(patch).eq("id", id).select().single()
    data = retry.data
    error = retry.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

  // Gate de permisos: cargar el resource y validar antes de borrar.
  const { data: existing } = await db
    .from("resources")
    .select("id, category, department_id")
    .eq("id", id)
    .single()
  if (!existing) {
    // Idempotente: si no existe, devolvemos success en vez de 404 para no
    // romper el flow del cliente cuando reintenta.
    return NextResponse.json({ success: true })
  }
  if (!canModifyResource(user.role, user.department_id, {
    category:      (existing as any).category ?? null,
    department_id: (existing as any).department_id ?? null,
  })) {
    return NextResponse.json({
      error: "No tenés permisos para eliminar este recurso.",
    }, { status: 403 })
  }

  const { error } = await db.from("resources").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
