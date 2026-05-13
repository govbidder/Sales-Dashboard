import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { getEffectiveUser } from "@/lib/auth/get-effective-user"

// GET /api/resources/favorites — lista los resource_ids favoriteados por el caller.
export async function GET(req: NextRequest) {
  const auth = await getEffectiveUser(req); const user = auth?.effectiveUser ?? null
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from("resource_favorites")
    .select("resource_id")
    .eq("user_id", user.id)

  if (error) {
    // Fallback: si la migration aún no se aplicó, devolvemos lista vacía en vez de
    // 500 — el feature degrada graciosamente sin romper el centro operativo.
    if (/relation .* does not exist|Could not find the table/i.test(error.message)) {
      return NextResponse.json({ favorites: [], migrationPending: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ favorites: (data ?? []).map(r => r.resource_id) })
}

// POST /api/resources/favorites — agrega un favorito.
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
  const { error } = await db
    .from("resource_favorites")
    .upsert({ user_id: user.id, resource_id: resourceId }, { onConflict: "user_id,resource_id" })

  if (error) {
    if (/relation .* does not exist|Could not find the table/i.test(error.message)) {
      return NextResponse.json({
        error: "Aplicá la migration 20260513000001_resource_favorites.sql en Supabase para habilitar favoritos.",
      }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

// DELETE /api/resources/favorites?resource_id=... — quita un favorito.
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
    .from("resource_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("resource_id", resourceId)

  if (error) {
    if (/relation .* does not exist|Could not find the table/i.test(error.message)) {
      return NextResponse.json({ success: true }) // no-op si la tabla no existe
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
