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
  let query = db.from("monday_wins").select("*").order("fecha", { ascending: false })
  if (client_id) query = query.eq("client_id", client_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ wins: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { client_id, fecha, logro_1, logro_2, logro_3, una_sola_cosa, bloqueo } = body

  if (!client_id || !fecha || !logro_1 || !una_sola_cosa || !bloqueo) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: client } = await db
    .from("crm_clients")
    .select("name")
    .eq("id", client_id)
    .maybeSingle()

  const { data, error } = await db
    .from("monday_wins")
    .insert({
      client_id,
      fecha,
      logro_1,
      logro_2:       logro_2  ?? null,
      logro_3:       logro_3  ?? null,
      una_sola_cosa,
      bloqueo,
      user_id:       user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ win: data, client_name: client?.name ?? null })
}
