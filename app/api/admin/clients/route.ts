import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

// GET — list all crm_clients with installments and followups
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()

  const { data: clients, error } = await db
    .from("crm_clients")
    .select(`
      *,
      installments:crm_installments(*),
      followups:crm_followups(*)
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[admin/clients GET]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const enriched = (clients ?? []).map((c: any) => ({
    ...c,
    installments: (c.installments ?? []).map((i: any) => {
      const due = new Date(i.due_date + "T12:00:00")
      due.setHours(0, 0, 0, 0)
      return {
        ...i,
        status: i.paid_at ? "pagado" : due < today ? "vencido" : "pendiente",
      }
    }).sort((a: any, b: any) => a.installment_number - b.installment_number),
    followups: (c.followups ?? []).sort((a: any, b: any) =>
      new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    ),
  }))

  return NextResponse.json({ clients: enriched })
}

// POST — create a followup for a client
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { type, client_id, scheduled_date, followup_type, notes } = body

  if (type !== "followup") {
    return NextResponse.json({ error: "type debe ser 'followup'" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: followup, error } = await db
    .from("crm_followups")
    .insert({ client_id, scheduled_date, type: followup_type ?? "whatsapp", notes: notes ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ followup })
}

// PATCH — update client, toggle installment, or toggle followup
export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const db = createServiceClient()

  // Toggle installment paid_at
  if (body.installment_id) {
    const { data: inst, error: fetchErr } = await db
      .from("crm_installments")
      .select("paid_at")
      .eq("id", body.installment_id)
      .single()
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const newPaidAt = inst.paid_at ? null : new Date().toISOString()
    const { error } = await db
      .from("crm_installments")
      .update({ paid_at: newPaidAt })
      .eq("id", body.installment_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ paid_at: newPaidAt })
  }

  // Toggle followup completed
  if (body.followup_id) {
    const { data: fu, error: fetchErr } = await db
      .from("crm_followups")
      .select("completed")
      .eq("id", body.followup_id)
      .single()
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const newCompleted = !fu.completed
    const { error } = await db
      .from("crm_followups")
      .update({ completed: newCompleted })
      .eq("id", body.followup_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ completed: newCompleted })
  }

  // Update client fields
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const { data: client, error } = await db
    .from("crm_clients")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client })
}

// DELETE — delete client or followup
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const db = createServiceClient()

  if (body.followup_id) {
    const { error } = await db.from("crm_followups").delete().eq("id", body.followup_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.id) {
    const { error } = await db.from("crm_clients").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "id o followup_id requerido" }, { status: 400 })
}
