import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"
import { type Role, isAdminOrAbove } from "@/lib/types/role"

async function getUserAndRole(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return { user: null, role: null }
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return { user: null, role: null }
  const db = createServiceClient()
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle()
  return { user, role: (profile?.role as Role | null | undefined) ?? "user" }
}

export async function GET(req: NextRequest) {
  const { user, role } = await getUserAndRole(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!isAdminOrAbove(role)) return NextResponse.json({ error: "Solo admins" }, { status: 403 })

  const url = new URL(req.url)
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 1000)
  const entity = url.searchParams.get("entity")    // optional filter
  const actor  = url.searchParams.get("actor")     // optional filter

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
