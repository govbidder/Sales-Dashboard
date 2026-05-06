import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase"

// Edge runtime: latencia más baja, ideal para llamadas cortas a la IA
// (este endpoint solo recibe título+descripción y devuelve JSON).
export const runtime = "edge"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

const SYSTEM_PROMPT = `Sos un asistente que ayuda a llenar campos de una tarea de gov contracting a partir del título y descripción.

Devolvés ÚNICAMENTE un JSON con esta forma exacta (sin markdown, sin code fences, sin texto):

{
  "priority":  "baja" | "media" | "alta" | "urgente",
  "tags":      ["snake_case", "snake_case"],
  "due_offset_hours": 24,
  "summary":   "Resumen ejecutivo de 1 línea (≤80 chars)"
}

REGLAS:
1. priority: inferir de keywords. "urgente/ASAP/EOD" → urgente. "esta semana/importante" → alta.
   Default → media.
2. tags: snake_case, máx 4 del dominio (bid, rfp, follow_up, internal, capability_statement,
   pricing, proposal, sam_gov, compliance, client, meeting, research, agency, submission).
3. due_offset_hours: entero positivo. Cuántas horas desde ahora hasta el deadline implícito.
   "EOD" → 8. "mañana" → 24. "viernes" → calcular hasta viernes 18hs.
   "esta semana" → 96. "próxima semana" → 168. Si no hay señal → null.
4. summary: 1 oración corta resumiendo qué hay que hacer y para quién, en imperativo.
5. NUNCA inventes nombres ni emails ni montos.
6. Solo el JSON. Nada más.`

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "AI no configurada" }, { status: 503 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }

  const title       = (body.title       ?? "").trim()
  const description = (body.description ?? "").trim()
  if (!title) return NextResponse.json({ error: "Falta el título" }, { status: 400 })

  const userMessage = description
    ? `Título: ${title}\n\nDescripción: ${description}`
    : `Título: ${title}`

  const now = new Date()
  const ctx = `Fecha actual: ${now.toISOString()} (${now.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long" })})`

  const client = new Anthropic({ apiKey })
  try {
    const completion = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 400,
      system:     SYSTEM_PROMPT + "\n\n" + ctx,
      messages: [{ role: "user", content: userMessage }],
    })

    const raw = completion.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim()

    const stripped = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    let parsed: any
    try { parsed = JSON.parse(stripped) } catch {
      return NextResponse.json({ error: "JSON inválido del modelo", raw }, { status: 502 })
    }

    const priority = ["baja","media","alta","urgente"].includes(parsed.priority) ? parsed.priority : "media"
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((x: any) => typeof x === "string").slice(0, 4)
      : []
    const dueOffsetHours = typeof parsed.due_offset_hours === "number" && Number.isFinite(parsed.due_offset_hours) && parsed.due_offset_hours > 0
      ? Math.min(parsed.due_offset_hours, 24 * 60)  // cap at 60 days
      : null
    const dueAt = dueOffsetHours != null
      ? new Date(now.getTime() + dueOffsetHours * 3600_000).toISOString()
      : null
    const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 200) : null

    return NextResponse.json({ priority, tags, due_at: dueAt, summary })
  } catch (e: any) {
    console.error("[tasks/suggest] anthropic error", e)
    return NextResponse.json({ error: "Error del modelo", detail: e?.message }, { status: 500 })
  }
}
