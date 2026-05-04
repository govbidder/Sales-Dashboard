import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, amount, status, description } = body

    if (!name?.trim() || amount == null) {
      return NextResponse.json({ error: "name y amount son requeridos" }, { status: 400 })
    }

    const db = createServiceClient()
    const { data, error } = await db
      .from("payments")
      .insert({
        name:        name.trim(),
        email:       email?.trim() || null,
        amount:      Number(amount),
        status:      status || "pendiente",
        description: description?.trim() || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ payment: data })
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
