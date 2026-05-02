import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { client_id, amount, currency, status, payment_date, method, notes } = body

    if (!client_id || !amount) {
      return NextResponse.json({ error: "client_id y amount son requeridos" }, { status: 400 })
    }

    const db = createServiceClient()
    const { data, error } = await db
      .from("payments")
      .insert({
        client_id,
        amount:       Number(amount),
        currency:     currency || "USD",
        status:       status || "completado",
        payment_date: payment_date || new Date().toISOString().split("T")[0],
        method:       method?.trim() || null,
        notes:        notes?.trim() || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enqueue event
    await db.from("outbound_events").insert({
      event_type: "payment.received",
      payload:    { payment_id: data.id, client_id, amount: data.amount, currency: data.currency },
      client_id,
      status:     "pending",
    }).then(() => {})

    return NextResponse.json({ payment: data })
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
