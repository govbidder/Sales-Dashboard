import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, phone, source, status, notes } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "name es requerido" }, { status: 400 })
    }

    const db = createServiceClient()
    const { data, error } = await db
      .from("crm_leads")
      .insert({
        name:   name.trim(),
        email:  email?.trim() || null,
        phone:  phone?.trim() || null,
        source: source?.trim() || null,
        status: status || "nuevo",
        notes:  notes?.trim() || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enqueue event
    await db.from("outbound_events").insert({
      event_type: "lead.created",
      payload:    { lead_id: data.id, name: data.name, email: data.email },
      status:     "pending",
    }).then(() => {})

    return NextResponse.json({ lead: data })
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
