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

interface ExtractRequest {
  text:        string
  /** When true, persists tasks immediately. When false, returns only the proposal. */
  persist?:    boolean
  /** Optional default assignee email for tasks where the AI can't infer one. */
  defaultAssignee?: string
}

interface ExtractedTask {
  title:       string
  description: string | null
  priority:    "baja" | "media" | "alta" | "urgente"
  due_at:      string | null   // ISO datetime
  tags:        string[]
  assignees:   string[]
  reasoning:   string          // why the AI parsed it this way (shown in preview)
}

const SYSTEM_PROMPT = `Sos un extractor de tareas para un dashboard de operaciones de GovBidder (gov contracting).

Tu trabajo: recibir un texto libre (un email del cliente, brief, notas de meeting, mensaje de WhatsApp, lo que sea) y devolver un JSON estructurado con las tareas accionables que detectás.

REGLAS DURAS:
1. Devolvés EXCLUSIVAMENTE un objeto JSON con la forma:
   { "tasks": [ { ...task1 }, { ...task2 } ] }
   Sin texto explicativo antes ni después. Sin markdown. Sin code fences.

2. Cada task tiene EXACTAMENTE estos campos:
   - title (string, máx 80 chars, en español, en imperativo: "Mandar propuesta a X", "Llamar a Y")
   - description (string o null, hasta 200 chars con el contexto que le ayudaría al ejecutor)
   - priority ("baja" | "media" | "alta" | "urgente")
   - due_at (string ISO 8601 con timezone Z, o null si no hay fecha clara)
   - tags (array de strings, snake_case, máx 4 — usá tags útiles tipo "propuesta", "follow_up", "bid", "internal")
   - assignees (array de strings con emails o nombres si los detectás explícitamente, vacío si no)
   - reasoning (1 oración corta en español explicando por qué interpretaste esto como tarea)

3. Si el texto no contiene tareas accionables, devolvés { "tasks": [] }.

4. Inferencia de prioridad:
   - "urgente": palabras como urgente / ASAP / hoy / EOD / inmediato, o deadlines en <24h
   - "alta": deadlines esta semana, blockers, "importante"
   - "media": deadlines más largos, requests normales (default)
   - "baja": "cuando puedas", "en algún momento"

5. Inferencia de fechas:
   - Si el texto menciona "mañana", "lunes que viene", "EOD viernes", convertilo a ISO usando la fecha actual que se te pasa en el contexto.
   - Si el texto solo dice "esta semana", asumí viernes 18:00 de la semana actual.
   - Si no hay fecha clara, devolvé null. NO inventes.

6. Inferencia de tags:
   - Detectá entidades del dominio: "bid", "propuesta", "rfp", "sam_gov", "follow_up", "internal", "meeting", "agency"
   - Máx 4 por tarea, snake_case.

7. Las descripciones nunca repiten el título. Aportan contexto extra (qué hay que mandar, a quién, números clave).

8. Tareas ATÓMICAS: una acción por tarea. Si el texto pide "preparar propuesta y mandarla", son DOS tareas.

EJEMPLOS:

Input: "Hola Santo, necesito que me mandes la capability statement del cliente XYZ urgente, antes del viernes. Y avisame cuando tengas la propuesta del bid 2024-DOD-007 lista."
Output:
{
  "tasks": [
    {
      "title": "Mandar capability statement de XYZ",
      "description": "Cliente XYZ pidió la capability statement.",
      "priority": "urgente",
      "due_at": "2026-05-08T18:00:00Z",
      "tags": ["client", "capability_statement"],
      "assignees": [],
      "reasoning": "Pedido explícito con deadline 'antes del viernes'."
    },
    {
      "title": "Avisar cuando esté lista la propuesta del bid 2024-DOD-007",
      "description": "Cliente espera notificación de finalización de propuesta.",
      "priority": "media",
      "due_at": null,
      "tags": ["bid", "follow_up"],
      "assignees": [],
      "reasoning": "Sin fecha específica, depende de cuándo esté lista la propuesta."
    }
  ]
}

Input: "Reunión cancelada"
Output: { "tasks": [] }
`

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

  let body: ExtractRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const text = (body.text ?? "").trim()
  if (!text) {
    return NextResponse.json({ error: "Falta el texto a procesar" }, { status: 400 })
  }
  if (text.length > 8000) {
    return NextResponse.json({ error: "Texto demasiado largo (máx 8000 caracteres)" }, { status: 400 })
  }

  // Inject current date so the model can resolve relative dates
  const now = new Date()
  const contextBlock = `Fecha actual: ${now.toISOString()} (${now.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })})`

  const client = new Anthropic({ apiKey })

  let parsed: { tasks: ExtractedTask[] }
  try {
    const completion = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 2000,
      system:     SYSTEM_PROMPT + "\n\n" + contextBlock,
      messages: [
        { role: "user", content: text },
      ],
    })

    const raw = completion.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim()

    // Tolerate accidental code fences
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    parsed = JSON.parse(stripped)
    if (!parsed || !Array.isArray(parsed.tasks)) throw new Error("invalid shape")
  } catch (e: any) {
    console.error("[tasks/extract] parse error", e)
    return NextResponse.json({
      error:  "El modelo no devolvió JSON válido",
      detail: e?.message ?? "Unknown",
    }, { status: 502 })
  }

  // Light sanitization
  const cleaned: ExtractedTask[] = parsed.tasks
    .filter((t: any) => t && typeof t.title === "string" && t.title.trim())
    .slice(0, 20)
    .map((t: any) => ({
      title:       String(t.title).slice(0, 200).trim(),
      description: t.description ? String(t.description).slice(0, 800) : null,
      priority:    ["baja", "media", "alta", "urgente"].includes(t.priority) ? t.priority : "media",
      due_at:      typeof t.due_at === "string" && /^\d{4}-\d{2}-\d{2}T/.test(t.due_at) ? t.due_at : null,
      tags:        Array.isArray(t.tags) ? t.tags.filter((x: any) => typeof x === "string").slice(0, 6) : [],
      assignees:   Array.isArray(t.assignees) ? t.assignees.filter((x: any) => typeof x === "string").slice(0, 5) : [],
      reasoning:   typeof t.reasoning === "string" ? t.reasoning.slice(0, 200) : "",
    }))

  // Apply defaultAssignee fallback
  if (body.defaultAssignee) {
    cleaned.forEach(t => {
      if (!t.assignees.length) t.assignees = [body.defaultAssignee!]
    })
  }

  // If persist=false (preview mode), return the proposal only
  if (!body.persist) {
    return NextResponse.json({ tasks: cleaned })
  }

  // Persist all tasks to the DB
  const db = createServiceClient()
  const rows = cleaned.map(t => ({
    title:       t.title,
    description: t.description,
    priority:    t.priority,
    due_at:      t.due_at,
    tags:        t.tags,
    assignees:   t.assignees,
    created_by:  user.email ?? null,
    status:      "pendiente" as const,
  }))

  const { data: inserted, error } = await db
    .from("tasks")
    .insert(rows)
    .select()

  if (error) {
    console.error("[tasks/extract] insert error", error)
    return NextResponse.json({ error: "No pude guardar las tareas", detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ tasks: inserted ?? [], proposal: cleaned })
}
