import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

interface TemplateSubtask {
  title:           string
  priority?:       "baja" | "media" | "alta" | "urgente"
  due_offset_days?: number | null
  tags?:           string[]
  assignees?:      string[]
}

// GET — list all templates
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from("task_templates")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data ?? [] })
}

// POST — dual purpose:
//   * If body.templateId → APPLY existing template (legacy behavior)
//   * If body.name + body.parent_title → CREATE new template
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }

  // ── Branch: CREATE new template ────────────────────────────────────────
  if (body.name && body.parent_title && !body.templateId) {
    const db = createServiceClient()
    const { data, error } = await db
      .from("task_templates")
      .insert({
        name:                   body.name,
        description:            body.description ?? null,
        icon:                   body.icon ?? null,
        color:                  body.color ?? "#1e3a8a",
        parent_title:           body.parent_title,
        parent_description:     body.parent_description ?? null,
        parent_priority:        body.parent_priority ?? "media",
        parent_tags:            body.parent_tags ?? [],
        parent_assignees:       body.parent_assignees ?? [],
        parent_due_offset_days: body.parent_due_offset_days ?? null,
        subtasks:               body.subtasks ?? [],
        is_default:             false,
        created_by:             user.email ?? null,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ template: data })
  }

  // ── Branch: APPLY existing template ────────────────────────────────────
  const templateId  = body.templateId as string
  const overrideTitle = body.title as string | undefined
  if (!templateId) return NextResponse.json({ error: "Falta templateId" }, { status: 400 })

  const db = createServiceClient()

  // 1) Load the template
  const { data: tmpl, error: tErr } = await db
    .from("task_templates")
    .select("*")
    .eq("id", templateId)
    .single()

  if (tErr || !tmpl) {
    return NextResponse.json({ error: "Template no encontrado" }, { status: 404 })
  }

  const now = Date.now()
  const day = 86_400_000

  const parentDueAt = tmpl.parent_due_offset_days != null
    ? new Date(now + tmpl.parent_due_offset_days * day).toISOString()
    : null

  // 2) Insert parent task
  const { data: parent, error: pErr } = await db
    .from("tasks")
    .insert({
      title:       overrideTitle || tmpl.parent_title,
      description: tmpl.parent_description,
      priority:    tmpl.parent_priority,
      tags:        tmpl.parent_tags ?? [],
      assignees:   tmpl.parent_assignees ?? [],
      due_at:      parentDueAt,
      status:      "pendiente",
      created_by:  user.email ?? null,
    })
    .select()
    .single()

  if (pErr || !parent) {
    return NextResponse.json({ error: "No pude crear la tarea principal", detail: pErr?.message }, { status: 500 })
  }

  // 3) Insert subtasks
  const subs: TemplateSubtask[] = Array.isArray(tmpl.subtasks) ? tmpl.subtasks : []
  if (subs.length) {
    const rows = subs.map(s => ({
      title:       s.title,
      priority:    s.priority ?? "media",
      tags:        s.tags ?? [],
      assignees:   s.assignees ?? [],
      due_at:      s.due_offset_days != null
        ? new Date(now + s.due_offset_days * day).toISOString()
        : null,
      parent_id:   parent.id,
      status:      "pendiente",
      created_by:  user.email ?? null,
    }))
    const { error: sErr } = await db.from("tasks").insert(rows)
    if (sErr) {
      console.error("[task-templates apply] subtasks insert failed", sErr)
      // parent already created; we don't roll back. Return partial.
    }
  }

  // 4) Return the parent task with subtasks count
  return NextResponse.json({
    task:          parent,
    subtasksCount: subs.length,
  })
}
