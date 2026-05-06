import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

interface ActivityItem {
  id:         string
  kind:       "task_created" | "task_updated" | "task_comment" | "task_status" | "persona_created"
  timestamp:  string
  actor:      string | null
  actor_name: string | null
  title:      string
  body:       string | null
  href:       string | null
  meta:       Record<string, any>
}

function enrichActor(email: string | null, profilesByEmail: Map<string, { name: string }>): { actor: string | null; actor_name: string | null } {
  if (!email) return { actor: null, actor_name: null }
  const p = profilesByEmail.get(email)
  return { actor: email, actor_name: p?.name ?? email.split("@")[0] }
}

// GET — chronological feed of last N activity events
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 500)
  const days  = parseInt(url.searchParams.get("days") ?? "30", 10)
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString()

  const db = createServiceClient()
  const [tasksRes, commentsRes, personasRes, profilesRes] = await Promise.all([
    db.from("tasks")
      .select("id,title,status,priority,owner,assignees,created_by,parent_id,created_at,updated_at,completed_at")
      .gte("updated_at", cutoff)
      .order("updated_at", { ascending: false })
      .limit(limit),
    db.from("task_comments")
      .select("id,task_id,author,content,kind,created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(limit),
    db.from("personas_agendadas")
      .select("id,name,owner,created_at,updated_at,sales_status")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("profiles").select("email,full_name,role,status"),
  ])

  // Build email → profile map for actor enrichment
  const profilesByEmail = new Map<string, { name: string }>()
  for (const p of (profilesRes.data ?? []) as any[]) {
    if (p.email) profilesByEmail.set(p.email, { name: p.full_name ?? p.email.split("@")[0] })
  }

  const tasks   = tasksRes.data    ?? []
  const comments = commentsRes.data ?? []
  const personas = personasRes.data ?? []

  // Index task titles for comment lookups
  const taskById = new Map(tasks.map((t: any) => [t.id, t]))

  const items: ActivityItem[] = []

  // Tasks: differentiate created vs. updated by checking if updated_at == created_at
  for (const t of tasks as any[]) {
    const created = !t.parent_id && t.created_at === t.updated_at
    if (created) {
      items.push({
        id:        `t-c-${t.id}`,
        kind:      "task_created",
        timestamp: t.created_at,
        ...enrichActor(t.created_by, profilesByEmail),
        title:     "Nueva tarea",
        body:      t.title,
        href:      "/admin/tasks",
        meta:      { task_id: t.id, priority: t.priority },
      })
    } else if (t.completed_at) {
      items.push({
        id:        `t-d-${t.id}`,
        kind:      "task_status",
        timestamp: t.completed_at,
        ...enrichActor(t.created_by, profilesByEmail),
        title:     "Tarea completada",
        body:      t.title,
        href:      "/admin/tasks",
        meta:      { task_id: t.id, status: "completada" },
      })
    } else {
      // Generic update (excludes plain re-saves of same data, best effort)
      items.push({
        id:        `t-u-${t.id}-${t.updated_at}`,
        kind:      "task_updated",
        timestamp: t.updated_at,
        ...enrichActor(t.created_by, profilesByEmail),
        title:     "Tarea actualizada",
        body:      t.title,
        href:      "/admin/tasks",
        meta:      { task_id: t.id, status: t.status, priority: t.priority },
      })
    }
  }

  // Comments
  for (const c of comments as any[]) {
    const task = taskById.get(c.task_id) as any
    const taskTitle = task?.title ?? "(tarea)"
    items.push({
      id:        `c-${c.id}`,
      kind:      "task_comment",
      timestamp: c.created_at,
      ...enrichActor(c.author, profilesByEmail),
      title:     c.kind === "system" ? "Evento" : "Comentario",
      body:      `${taskTitle}: ${c.content}`,
      href:      "/admin/tasks",
      meta:      { task_id: c.task_id, kind: c.kind },
    })
  }

  // Personas creation
  for (const p of personas as any[]) {
    items.push({
      id:        `p-${p.id}`,
      kind:      "persona_created",
      timestamp: p.created_at,
      ...enrichActor(p.owner, profilesByEmail),
      title:     "Nueva persona agendada",
      body:      p.name,
      href:      "/admin/personas",
      meta:      { persona_id: p.id, sales_status: p.sales_status },
    })
  }

  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  return NextResponse.json({ items: items.slice(0, limit) })
}
