import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdminOrAbove } from "@/lib/types/role"
import { getEffectiveUser } from "@/lib/auth/get-effective-user"

export async function GET(req: NextRequest) {
  const auth = await getEffectiveUser(req)
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!isAdminOrAbove(auth.effectiveUser.role)) {
    return NextResponse.json({ error: "Solo admins" }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 1000)
  const entity = url.searchParams.get("entity")
  const actor  = url.searchParams.get("actor")

  const db = createServiceClient()
  let q = db.from("audit_log").select("*").order("created_at", { ascending: false }).limit(limit)
  if (entity) q = q.eq("entity", entity)
  if (actor)  q = q.eq("actor", actor)

  const { data, error } = await q
  if (error) {
    // Probably the table doesn't exist yet — graceful degradation
    return NextResponse.json({ entries: [], unavailable: true, hint: "Aplicá supabase/migrations/20250506000002_audit_log.sql" })
  }
  return NextResponse.json({ entries: data ?? [] })
}
