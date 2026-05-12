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

/** Fetch caller profile (role + department) for scoping decisions. */
async function getCallerProfile(userId: string) {
  const db = createServiceClient()
  const { data } = await db
    .from("profiles")
    .select("role, department_id")
    .eq("id", userId)
    .single()
  return {
    role: (data?.role as Role | undefined) ?? "user",
    departmentId: ((data as any)?.department_id as string | null) ?? null,
  }
}

// GET /api/admin/tasks
//   ?persona_id=xxx     filter by persona
//   ?owner=foo          filter where owner = foo
//   ?assignee=foo       filter where foo is in assignees array
//   ?status=pendiente   filter by status
//   ?parent_id=xxx      get subtasks of a parent
//   ?include_subtasks=true  default behavior returns top-level only; set true to also return all
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const personaId       = req.nextUrl.searchParams.get("persona_id")
  const owner           = req.nextUrl.searchParams.get("owner")
  const assignee        = req.nextUrl.searchParams.get("assignee")
  const status          = req.nextUrl.searchParams.get("status")
  const parentId        = req.nextUrl.searchParams.get("parent_id")
  const includeSubtasks = req.nextUrl.searchParams.get("include_subtasks") === "true"

  const db = createServiceClient()
  let query = db.from("tasks").select("*")

  // Scoping para empleados: ven solo tasks de su depto + las que tienen asignadas
  // por owner/assignees. Admins y super_admin ven todo.
  const caller = await getCallerProfile(user.id)
  if (!isAdminOrAbove(caller.role)) {
    const email = user.email ?? ""
    if (caller.departmentId) {
      query = query.or(
        `department_id.eq.${caller.departmentId},owner.eq.${email},assignees.cs.{${email}}`
      )
    } else {
      // Empleado sin depto asignado: solo ve tasks suyas (owner o assignee).
      query = query.or(`owner.eq.${email},assignees.cs.{${email}}`)
    }
  }

  if (personaId)              query = query.eq("persona_id", personaId)
  if (owner)                  query = query.eq("owner", owner)
  if (assignee)               query = query.contains("assignees", [assignee])
  if (status)                 query = query.eq("status", status)
  if (parentId)               query = query.eq("parent_id", parentId)
  else if (!includeSubtasks)  query = query.is("parent_id", null)

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
      owner:       body.owner?.trim() || null,
      assignees:   Array.isArray(body.assignees) ? body.assignees.filter(Boolean) : [],
      tags:        Array.isArray(body.tags)      ? body.tags.filter(Boolean)      : [],
      due_at:      body.due_at   || null,
      persona_id:  body.persona_id || null,
      parent_id:     body.parent_id    || null,
      department_id: body.department_id || null,
      created_by:    user.email || user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-log creation as a system comment
  await db.from("task_comments").insert({
    task_id: data.id,
    author:  user.email || user.id,
    kind:    "system",
    content: "Tarea creada",
  })

  return NextResponse.json({ task: data })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  // Auto-stamp completed_at on status flip
  if (updates.status === "completada" && !updates.completed_at) {
    updates.completed_at = new Date().toISOString()
  } else if (updates.status && updates.status !== "completada") {
    updates.completed_at = null
  }

  const db = createServiceClient()

  // Get current snapshot for activity log
  const { data: prev } = await db.from("tasks").select("status, priority, assignees").eq("id", id).single()

  const { data, error } = await db
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log meaningful changes
  const author = user.email || user.id
  const events: string[] = []
  if (prev && updates.status && prev.status !== updates.status) {
    events.push(`Estado: ${prev.status} → ${updates.status}`)
  }
  if (prev && updates.priority && prev.priority !== updates.priority) {
    events.push(`Prioridad: ${prev.priority} → ${updates.priority}`)
  }
  for (const txt of events) {
    await db.from("task_comments").insert({ task_id: id, author, kind: "system", content: txt })
  }

  return NextResponse.json({ task: data })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const db = createServiceClient()

  // Snapshot for audit
  const { data: before } = await db.from("tasks").select("title,status,priority").eq("id", id).maybeSingle()

  const { error } = await db.from("tasks").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit (fire and forget)
  const { audit } = await import("@/lib/audit")
  await audit(req, {
    actor:     user.email ?? null,
    action:    "task.delete",
    entity:    "task",
    entity_id: id,
    payload:   { before },
  })

  return NextResponse.json({ success: true })
}
