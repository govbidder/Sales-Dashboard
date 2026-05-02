import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get("client_id")

  const db = createServiceClient()
  let query = db.from("chi_chang").select("*").order("fecha", { ascending: false })
  if (client_id) query = query.eq("client_id", client_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { client_id, fecha, valor_trato, cash_collected, proximo_nivel } = body

  if (!client_id || !fecha || !valor_trato || !cash_collected) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 })
  }

  const db = createServiceClient()

  // Get client name for the response message
  const { data: client } = await db
    .from("crm_clients")
    .select("name")
    .eq("id", client_id)
    .maybeSingle()

  const { data, error } = await db
    .from("chi_chang")
    .insert({
      client_id,
      fecha,
      valor_trato:    Number(valor_trato),
      cash_collected: Number(cash_collected),
      proximo_nivel:  proximo_nivel ?? null,
      user_id:        user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data, client_name: client?.name ?? null })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db.from("chi_chang").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
