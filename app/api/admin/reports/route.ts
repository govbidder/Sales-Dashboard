import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

// PATCH — update a single field in monthly_reports (used by admin-data-view inline editing)
export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { client_id, month, field, value } = await req.json()
  if (!client_id || !month || !field) {
    return NextResponse.json({ error: "client_id, month y field son requeridos" }, { status: 400 })
  }

  const monthDate = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month
  const db = createServiceClient()

  const { error } = await db
    .from("monthly_reports")
    .upsert(
      { client_id, month: monthDate, [field]: value, updated_at: new Date().toISOString() },
      { onConflict: "client_id,month" }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get("client_id")

  const db = createServiceClient()
  let query = db.from("monthly_reports").select("*").order("month", { ascending: false })
  if (client_id) query = query.eq("client_id", client_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}
