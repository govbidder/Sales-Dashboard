import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { getEffectiveUser } from "@/lib/auth/get-effective-user"

// GET /api/resources/read-state — devuelve { [resource_id]: read_at_iso }
// para todos los recursos que el caller marcó como leídos.
export async function GET(req: NextRequest) {
  const auth = await getEffectiveUser(req); const user = auth?.effectiveUser ?? null
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from("resource_read_state")
    .select("resource_id, read_at")
    .eq("user_id", user.id)

  if (error) {
    // Degrada graciosamente si la migration no se aplicó.
    if (/relation .* does not exist|Could not find the table/i.test(error.message)) {
      return NextResponse.json({ readState: {}, migrationPending: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    map[(row as any).resource_id] = (row as any).read_at
  }
  return NextResponse.json({ readState: map })
}

// POST /api/resources/read-state — marca como leído (refresca read_at a now()).
// Body: { resource_id: string }
export async function POST(req: NextRequest) {
  const auth = await getEffectiveUser(req); const user = auth?.effectiveUser ?? null
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const resourceId = body?.resource_id
  if (!resourceId || typeof resourceId !== "string") {
    return NextResponse.json({ error: "resource_id requerido" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("resource_read_state")
    .upsert(
      { user_id: user.id, resource_id: resourceId, read_at: new Date().toISOString() },
      { onConflict: "user_id,resource_id" },
    )
    .select("read_at")
    .single()

  if (error) {
    if (/relation .* does not exist|Could not find the table/i.test(error.message)) {
      return NextResponse.json({
        error: "Aplicá la migration 20260513000003_resource_read_state.sql en Supabase para habilitar 'marcar como leído'.",
      }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ read_at: (data as any)?.read_at ?? null })
}

// DELETE /api/resources/read-state?resource_id=... — vuelve a "no leído".
export async function DELETE(req: NextRequest) {
  const auth = await getEffectiveUser(req); const user = auth?.effectiveUser ?? null
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  let resourceId = searchParams.get("resource_id")
  if (!resourceId) {
    try { const body = await req.json(); resourceId = body?.resource_id ?? null } catch {}
  }
  if (!resourceId) return NextResponse.json({ error: "resource_id requerido" }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db
    .from("resource_read_state")
    .delete()
    .eq("user_id", user.id)
    .eq("resource_id", resourceId)

  if (error) {
    if (/relation .* does not exist|Could not find the table/i.test(error.message)) {
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
