import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { id, client_id, month } = body

  const db = createServiceClient()

  if (id) {
    const { error } = await db.from("monthly_reports").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (client_id && month) {
    const monthDate = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month
    const { error } = await db.from("monthly_reports").delete().eq("client_id", client_id).eq("month", monthDate)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Requerido: id o client_id+month" }, { status: 400 })
}
