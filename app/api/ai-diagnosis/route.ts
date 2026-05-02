import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

async function runDiagnosis(prompt: string, auditType: string, annualRevenue: string, selectedMonth: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Graceful degradation — return a templated response
    return [
      `## Diagnóstico IA — ${auditType}`,
      "",
      `**Período analizado:** ${selectedMonth}`,
      `**Ingresos anuales:** ${annualRevenue}`,
      "",
      "### Análisis",
      "El diagnóstico automático requiere configuración de la API de IA. Por favor, contactá al administrador para activar esta función.",
      "",
      "### Recomendaciones",
      "- Revisar los KPIs del período seleccionado",
      "- Comparar con el mes anterior",
      "- Identificar las principales oportunidades de mejora",
    ].join("\n")
  }

  const { Anthropic } = await import("@anthropic-ai/sdk")
  const anthropic = new Anthropic({ apiKey })

  const message = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Eres un consultor de negocios experto. Analiza el siguiente caso y proporciona un diagnóstico detallado en español.\n\nTipo de auditoría: ${auditType}\nIngresos anuales: ${annualRevenue}\nPeríodo: ${selectedMonth}\n\n${prompt}`,
      },
    ],
  })

  const content = message.content[0]
  return content.type === "text" ? content.text : "Sin respuesta"
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const requestId = searchParams.get("request_id")

  const db = createServiceClient()

  if (requestId) {
    const { data: reqData } = await db
      .from("ai_diagnosis_requests")
      .select("*")
      .eq("id", requestId)
      .eq("user_id", user.id)
      .single()

    if (!reqData) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    const { data: resultData } = await db
      .from("ai_diagnosis_results")
      .select("*")
      .eq("request_id", requestId)
      .single()

    return NextResponse.json({ request: reqData, result: resultData ?? null })
  }

  // Return latest request + result for this user
  const { data: latest } = await db
    .from("ai_diagnosis_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!latest) return NextResponse.json({ request: null, result: null })

  const { data: resultData } = await db
    .from("ai_diagnosis_results")
    .select("*")
    .eq("request_id", latest.id)
    .single()

  return NextResponse.json({ request: latest, result: resultData ?? null })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { prompt, auditType = "general", annualRevenue = "N/A", selectedMonth = "", clientId } = body

  if (!prompt?.trim()) return NextResponse.json({ error: "prompt es requerido" }, { status: 400 })

  const db = createServiceClient()

  // Create request record
  const { data: diagReq, error: reqErr } = await db
    .from("ai_diagnosis_requests")
    .insert({
      user_id:        user.id,
      prompt:         prompt.trim(),
      audit_type:     auditType,
      annual_revenue: annualRevenue,
      selected_month: selectedMonth,
      client_id:      clientId ?? null,
      status:         "processing",
    })
    .select()
    .single()

  if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 })

  try {
    const result = await runDiagnosis(prompt, auditType, annualRevenue, selectedMonth)

    // Save result
    await db.from("ai_diagnosis_results").insert({
      request_id: diagReq.id,
      result,
      raw_response: null,
    })

    // Update request status
    await db.from("ai_diagnosis_requests").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", diagReq.id)

    return NextResponse.json({ request_id: diagReq.id, result })
  } catch (err: any) {
    await db.from("ai_diagnosis_requests").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", diagReq.id)
    return NextResponse.json({ error: err?.message ?? "Error al generar diagnóstico" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { request_id } = body
  if (!request_id) return NextResponse.json({ error: "request_id requerido" }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db
    .from("ai_diagnosis_requests")
    .delete()
    .eq("id", request_id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
