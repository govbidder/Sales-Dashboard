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

interface ComposeRequest {
  /** ID de la persona agendada — el server pulla nombre, contexto, último seguimiento */
  personaId:    string
  /** "follow_up" | "first_contact" | "nurture" | "check_in" | "thank_you" | "custom" */
  intent:       string
  /** Tono: "formal" | "casual" | "directo" */
  tone?:        "formal" | "casual" | "directo"
  /** Idioma. Default: español */
  language?:    "es" | "en"
  /** Notas adicionales del usuario (contexto, qué quiere lograr) */
  notes?:       string
}

const SYSTEM_PROMPT = `Sos un asistente que redacta emails de seguimiento personalizados para un equipo de gov contracting.

Devolvés EXCLUSIVAMENTE un JSON con esta forma exacta:
{
  "subject": "Subject del email (≤80 chars)",
  "body":    "Cuerpo del email en texto plano con saltos de línea \\n\\n entre párrafos. NO HTML.",
  "preview": "Preview de 1 línea que iría en el inbox (≤120 chars)"
}

REGLAS:
1. Sin markdown, sin code fences, sin texto explicativo. Solo el JSON.
2. El body es texto plano. Los párrafos se separan con doble \\n.
3. Empezás con saludo personalizado usando el nombre de la persona.
4. Si tenés contexto (último seguimiento, sales_status), referenciálo naturalmente.
5. Cerrás con call-to-action claro y específico (no genérico tipo "esperamos tu respuesta").
6. Despedida + firma genérica ("Equipo GovBidder").
7. Tono según el parámetro:
   - formal: usted, expresiones formales
   - casual: tú/vos, tono cercano
   - directo: brevedad, va al grano sin floreo
8. Idioma según el parámetro (default español).
9. NUNCA inventes datos del cliente, agencias, montos, dates específicos.
10. Si el contexto es escaso, sé genérico pero cálido — no rellenes con datos falsos.

INTENTS:
- first_contact: primera reunión / introducción inicial
- follow_up: ya hablaron, retomás contacto
- nurture: mantener relación, sin agenda específica
- check_in: chequear si necesita ayuda con algo
- thank_you: agradecer (después de meeting, decisión, etc)
- custom: free-form, basado en notes`

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "AI no configurada" }, { status: 503 })

  let body: ComposeRequest
  try { body = await req.json() } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }

  if (!body.personaId) return NextResponse.json({ error: "Falta personaId" }, { status: 400 })

  // Pull persona context
  const db = createServiceClient()
  const [pRes, sRes] = await Promise.all([
    db.from("personas_agendadas").select("*").eq("id", body.personaId).single(),
    db.from("seguimientos").select("kind,content,author,created_at").eq("persona_id", body.personaId).order("created_at", { ascending: false }).limit(5),
  ])

  if (pRes.error || !pRes.data) {
    return NextResponse.json({ error: "Persona no encontrada" }, { status: 404 })
  }
  const persona = pRes.data as any
  const seguimientos = (sRes.data ?? []) as any[]

  const ctxLines: string[] = []
  ctxLines.push(`Persona: ${persona.name}${persona.email ? ` <${persona.email}>` : ""}`)
  if (persona.phone)        ctxLines.push(`Teléfono: ${persona.phone}`)
  if (persona.scheduled_at) ctxLines.push(`Próxima reunión agendada: ${new Date(persona.scheduled_at).toLocaleString("es-AR")}`)
  if (persona.sales_status) ctxLines.push(`Estado de venta: ${persona.sales_status}`)
  if (persona.call_status)  ctxLines.push(`Estado de llamada: ${persona.call_status}`)
  if (persona.source)       ctxLines.push(`Origen del lead: ${persona.source}`)
  if (persona.notes)        ctxLines.push(`Notas internas: ${persona.notes}`)
  if (persona.owner)        ctxLines.push(`Owner asignado: ${persona.owner}`)
  if (seguimientos.length) {
    ctxLines.push("")
    ctxLines.push(`Últimos ${seguimientos.length} seguimientos (cronológico desc):`)
    for (const s of seguimientos) {
      ctxLines.push(`- [${new Date(s.created_at).toLocaleDateString("es-AR")}] (${s.kind}) ${s.author ?? "—"}: ${(s.content ?? "").slice(0, 200)}`)
    }
  }

  ctxLines.push("")
  ctxLines.push(`Intent del email: ${body.intent}`)
  ctxLines.push(`Tono: ${body.tone ?? "casual"}`)
  ctxLines.push(`Idioma: ${body.language ?? "es"}`)
  if (body.notes) ctxLines.push(`Notas del usuario: ${body.notes}`)

  const userMessage = `Redactá el email para esta persona:\n\n${ctxLines.join("\n")}`

  const client = new Anthropic({ apiKey })
  try {
    const completion = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 1500,
      system:     SYSTEM_PROMPT,
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

    return NextResponse.json({
      subject: typeof parsed.subject === "string" ? parsed.subject.slice(0, 200) : "",
      body:    typeof parsed.body    === "string" ? parsed.body                   : "",
      preview: typeof parsed.preview === "string" ? parsed.preview.slice(0, 200) : "",
      persona: { id: persona.id, name: persona.name, email: persona.email },
    })
  } catch (e: any) {
    console.error("[ai-email] anthropic error", e)
    return NextResponse.json({ error: "Error del modelo", detail: e?.message }, { status: 500 })
  }
}
