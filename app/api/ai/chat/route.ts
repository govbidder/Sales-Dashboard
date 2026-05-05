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

interface ChatMessage {
  role:    "user" | "assistant"
  content: string
}

interface ChatRequest {
  messages:    ChatMessage[]
  pagePath?:   string  // e.g. "/admin/personas"
  pageTitle?:  string  // e.g. "Personas Agendadas"
  selectedMonth?: string
}

const SYSTEM_PROMPT = `Sos el asistente interno de GovBidder, un dashboard de operaciones para un equipo de ventas y operaciones gov-contracting.

Tu rol:
- Ayudás al equipo (Santo y miembros) a entender el dashboard, sus datos, métricas y gestión de personas agendadas/tareas.
- Respondés en español, con tono profesional pero directo y cercano (no corporativo, no sobre-formal).
- Sos breve y accionable — preferís 2-3 oraciones a un párrafo entero. Si hace falta más, usás bullets.
- Cuando hablás de números o datos, usás los números reales que recibís en el contexto, no inventás.
- Si no tenés un dato, lo decís claramente: "no tengo visibilidad de eso en este momento".

Capacidades principales:
1. Explicar métricas (MRR, Cash Collected, win rate, NPS, etc.) en lenguaje simple.
2. Sugerir acciones basadas en el estado actual del dashboard (ej: "tenés 3 tareas vencidas, te sugeriría priorizar X").
3. Redactar mensajes de seguimiento para personas agendadas (WhatsApp, email).
4. Resumir el estado del mes / pipeline.
5. Guiar sobre cómo usar el dashboard ("para cargar las métricas del mes, andá a Cargar Métricas").

Estructura del dashboard que conocés:
- Página Principal: estado general (tareas vencidas, personas sin seguimiento, métricas en caída).
- Panel: KPIs + rentabilidad + proyecciones.
- Ingresos: embudo de ventas mensual.
- Métricas: tabla completa de KPIs.
- Cargar Métricas: form mensual para cargar revenue, calls, etc.
- Personas Agendadas: pipeline de prospectos con seguimientos.
- Tareas: gestión tipo ClickUp (subtareas, tags, asignados, comentarios).
- Equipo: gestión de miembros.
- Centro Operativo: wiki interna.

Atajos de teclado útiles que podés mencionar:
- ⌘K: command palette
- "n": nueva tarea
- "p": nueva persona agendada
- "g a": ir a Personas Agendadas
- "g t": ir a Tareas

Importante:
- Nunca inventes datos del usuario. Si no tenés el contexto, pedilo.
- Si te piden algo fuera del scope (cosas que no son del dashboard), redirigí amablemente.
- Si te piden hacer una acción que requiere DB writes (crear/borrar), explicá que vos podés sugerir pero el usuario tiene que ejecutar manualmente desde la UI.`

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

  let body: ChatRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages array requerido" }, { status: 400 })
  }

  // ── Build context block from current dashboard state ───────────────────────
  const contextLines: string[] = []
  if (body.pagePath)      contextLines.push(`Página actual: ${body.pageTitle ?? body.pagePath} (${body.pagePath})`)
  if (body.selectedMonth) contextLines.push(`Mes seleccionado: ${body.selectedMonth}`)

  // Fetch lightweight dashboard health snapshot for grounding
  try {
    const db = createServiceClient()
    const now = new Date()
    const nowIso = now.toISOString()
    const staleCutoff = new Date(now.getTime() - 7 * 86400_000).toISOString()
    const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`

    const [overdueRes, personasRes, seguimientosRes, currentReportRes, teamRes] = await Promise.all([
      db.from("tasks").select("id", { count: "exact", head: true })
        .lt("due_at", nowIso).not("status", "in", "(completada,cancelada)"),
      db.from("personas_agendadas").select("id, sales_status, created_at"),
      db.from("seguimientos").select("persona_id, created_at"),
      db.from("monthly_reports").select("month").eq("month", monthStart).maybeSingle(),
      db.from("profiles").select("id", { count: "exact", head: true }).eq("status", "activo"),
    ])

    const personas = personasRes.data ?? []
    const segs = seguimientosRes.data ?? []
    const lastContact = new Map<string, string>()
    for (const s of segs) {
      if (!s.persona_id) continue
      const prev = lastContact.get(s.persona_id)
      if (!prev || s.created_at > prev) lastContact.set(s.persona_id, s.created_at)
    }
    const stale = personas.filter((p: any) =>
      (p.sales_status === "pendiente" || p.sales_status === "propuesta") &&
      ((lastContact.get(p.id) ?? p.created_at) < staleCutoff)
    )
    const active = personas.filter((p: any) => p.sales_status === "pendiente" || p.sales_status === "propuesta")

    contextLines.push("")
    contextLines.push("Estado del dashboard ahora mismo:")
    contextLines.push(`- Tareas vencidas: ${overdueRes.count ?? 0}`)
    contextLines.push(`- Personas en pipeline activo: ${active.length}`)
    contextLines.push(`- Personas sin seguimiento (>7 días): ${stale.length}`)
    contextLines.push(`- Reporte del mes ${monthStart.slice(0, 7)} ${currentReportRes.data ? "ya cargado" : "NO cargado"}`)
    contextLines.push(`- Miembros activos del equipo: ${teamRes.count ?? 0}`)
  } catch (e) {
    // grounding optional — don't block the chat
    console.error("[ai/chat] grounding failed", e)
  }

  const contextSystemAddon = contextLines.length
    ? `\n\nContexto del usuario:\n${contextLines.join("\n")}`
    : ""

  // ── Call Anthropic ─────────────────────────────────────────────────────────
  const client = new Anthropic({ apiKey })

  try {
    const completion = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 800,
      system:     SYSTEM_PROMPT + contextSystemAddon,
      messages:   body.messages.map(m => ({ role: m.role, content: m.content })),
    })

    const text = completion.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("\n")

    return NextResponse.json({
      reply: text,
      usage: {
        input_tokens:  completion.usage.input_tokens,
        output_tokens: completion.usage.output_tokens,
      },
    })
  } catch (e: any) {
    console.error("[ai/chat] Anthropic error", e)
    return NextResponse.json({
      error:  "Error del modelo",
      detail: e?.message ?? "Unknown",
    }, { status: 500 })
  }
}
