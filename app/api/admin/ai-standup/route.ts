import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

const SYSTEM_PROMPT = `Sos el asistente de standup diario de GovBidder, un dashboard para un equipo de gov contracting.

Tu trabajo: recibir un snapshot del estado del dashboard de las últimas 24h y generar un resumen ejecutivo en markdown listo para pegar en Slack/WhatsApp.

ESTRUCTURA EXACTA:

## 📅 Standup — <fecha>

**🟢 Avances**
- (lo que se completó / cambió a "completada" / progresos visibles)

**🟦 En curso**
- (tareas tocadas pero todavía no terminadas)

**🔴 Bloqueos / Riesgo**
- (vencidas, urgentes que no avanzan, comentarios que sugieren bloqueo)

**📌 Para hoy**
- (próximas vencimientos en ≤48h, sugerencias de prioridad para el día)

REGLAS:
1. Bullets cortos (≤80 chars cada uno).
2. Solo mencionás cosas reales del snapshot. NO inventás.
3. Si una sección está vacía, escribí "_(sin novedades)_".
4. Si hay >5 items en una sección, agrupás los menos importantes en "+N más".
5. Tono profesional pero directo. Sin formalidades. En español rioplatense.
6. NO uses emojis adicionales más allá de los que están en los headers.
7. Mencionás owners por email cuando sea relevante (ej: "Marcelo cerró bid X").
8. NUNCA pongas markdown extra (no headers H1, no code blocks). Empezás directo en "## 📅 Standup".`

interface DigestTask {
  id:           string
  title:        string
  status:       string
  priority:     string
  due_at:       string | null
  assignees:    string[]
  updated_at:   string
  created_at:   string
  parent_id:    string | null
}

interface DigestComment {
  id:         string
  task_id:    string
  author:     string | null
  content:    string
  kind:       string
  created_at: string
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      error: "AI no configurada",
      detail: "Falta ANTHROPIC_API_KEY en el entorno.",
    }, { status: 503 })
  }

  // ── Pull 24h snapshot ──────────────────────────────────────────────────────
  const db = createServiceClient()
  const now = new Date()
  const cutoff = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()
  const upcomingCutoff = new Date(now.getTime() + 48 * 3600 * 1000).toISOString()

  const [updatedRes, recentCommentsRes, overdueRes, upcomingRes] = await Promise.all([
    db.from("tasks").select("id,title,status,priority,due_at,assignees,updated_at,created_at,parent_id")
      .gte("updated_at", cutoff).order("updated_at", { ascending: false }).limit(50),
    db.from("task_comments").select("id,task_id,author,content,kind,created_at")
      .gte("created_at", cutoff).order("created_at", { ascending: false }).limit(30),
    db.from("tasks").select("id,title,status,priority,due_at,assignees,updated_at,created_at,parent_id")
      .lt("due_at", now.toISOString()).not("status", "in", "(completada,cancelada)").limit(20),
    db.from("tasks").select("id,title,status,priority,due_at,assignees,updated_at,created_at,parent_id")
      .gte("due_at", now.toISOString()).lte("due_at", upcomingCutoff)
      .not("status", "in", "(completada,cancelada)").order("due_at", { ascending: true }).limit(20),
  ])

  const updated  = (updatedRes.data    ?? []) as DigestTask[]
  const comments = (recentCommentsRes.data ?? []) as DigestComment[]
  const overdue  = (overdueRes.data    ?? []) as DigestTask[]
  const upcoming = (upcomingRes.data   ?? []) as DigestTask[]

  // Build a compact text snapshot to pass to Claude
  const fmtTask = (t: DigestTask) => {
    const due = t.due_at ? ` · vence ${new Date(t.due_at).toLocaleString("es-AR")}` : ""
    const ass = t.assignees?.length ? ` · ${t.assignees.join(",")}` : ""
    return `[${t.id.slice(0, 8)}] (${t.status}/${t.priority}) ${t.title}${due}${ass}`
  }
  const fmtComment = (c: DigestComment) => {
    const author = c.author ?? "?"
    const kind   = c.kind === "system" ? " [SYS]" : ""
    return `${author}${kind}: ${c.content.slice(0, 200)}`
  }

  const lines: string[] = []
  lines.push(`Fecha actual: ${now.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`)
  lines.push(`Ventana del standup: últimas 24h (desde ${cutoff})`)
  lines.push("")

  if (updated.length) {
    lines.push(`### Tareas modificadas en últimas 24h (${updated.length}):`)
    updated.forEach(t => lines.push(`- ${fmtTask(t)}`))
    lines.push("")
  }
  if (overdue.length) {
    lines.push(`### Tareas VENCIDAS no completadas (${overdue.length}):`)
    overdue.forEach(t => lines.push(`- ${fmtTask(t)}`))
    lines.push("")
  }
  if (upcoming.length) {
    lines.push(`### Próximos vencimientos (≤48h) (${upcoming.length}):`)
    upcoming.forEach(t => lines.push(`- ${fmtTask(t)}`))
    lines.push("")
  }
  if (comments.length) {
    lines.push(`### Comentarios y eventos en últimas 24h (${comments.length}):`)
    comments.forEach(c => {
      const taskRef = updated.find(t => t.id === c.task_id) ??
                      overdue.find(t => t.id === c.task_id) ??
                      upcoming.find(t => t.id === c.task_id)
      const taskTitle = taskRef ? ` (sobre "${taskRef.title}")` : ""
      lines.push(`- ${fmtComment(c)}${taskTitle}`)
    })
    lines.push("")
  }

  if (!updated.length && !overdue.length && !upcoming.length && !comments.length) {
    lines.push("(Sin actividad en las últimas 24h.)")
  }

  const snapshot = lines.join("\n")

  // ── Call Anthropic ────────────────────────────────────────────────────────
  const client = new Anthropic({ apiKey })
  try {
    const completion = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 1500,
      system:     SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Generá el standup a partir de este snapshot:\n\n${snapshot}` },
      ],
    })

    const markdown = completion.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim()

    return NextResponse.json({
      markdown,
      meta: {
        updated_count:  updated.length,
        overdue_count:  overdue.length,
        upcoming_count: upcoming.length,
        comments_count: comments.length,
        generated_at:   now.toISOString(),
      },
    })
  } catch (e: any) {
    console.error("[ai-standup] anthropic error", e)
    return NextResponse.json({
      error:  "Error generando el standup",
      detail: e?.message ?? "Unknown",
    }, { status: 500 })
  }
}
