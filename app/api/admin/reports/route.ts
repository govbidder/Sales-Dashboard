import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { getEffectiveUser } from "@/lib/auth/get-effective-user"
import { isAdminOrAbove } from "@/lib/types/role"

const NUMERIC_FIELDS = [
  "total_revenue", "cash_collected", "mrr", "ad_spend", "software_costs", "variable_costs",
  "scheduled_calls", "attended_calls", "qualified_calls", "no_show", "open_conversations",
  "applications", "inbound_messages",
  "offer_docs_sent", "offer_docs_responded", "cierres_por_offerdoc",
  "new_clients", "active_clients",
  "short_followers", "short_reach", "short_posts",
  "yt_subscribers", "yt_new_subscribers", "yt_monthly_audience", "yt_views", "yt_watch_time", "yt_videos",
  "email_subscribers", "email_new_subscribers",
  "nps_score",
] as const

const TEXT_FIELDS = [
  "biggest_win", "next_focus", "support_needed", "improvements",
] as const

function sanitize(body: any) {
  const out: Record<string, any> = {}
  for (const k of NUMERIC_FIELDS) {
    if (k in body) {
      const v = body[k]
      if (v === "" || v == null) out[k] = null
      else {
        const n = Number(v)
        out[k] = Number.isFinite(n) ? n : null
      }
    }
  }
  for (const k of TEXT_FIELDS) {
    if (k in body) {
      const v = body[k]
      out[k] = (typeof v === "string" && v.trim()) ? v.trim() : null
    }
  }
  return out
}

/**
 * Normaliza el parámetro `department` que puede ser:
 *   - null / "global" → fila global (department_id IS NULL)
 *   - "all"           → todas (global + todos los deptos)
 *   - "<uuid>"        → ese depto
 *   - undefined       → mismo que "global" (backwards-compat)
 */
function parseDeptParam(raw: string | null): "global" | "all" | string {
  if (!raw || raw === "global") return "global"
  if (raw === "all") return "all"
  return raw // assume uuid
}

// GET /api/admin/reports                                      → todas las filas globales (default)
// GET /api/admin/reports?month=2025-05                        → un reporte global de ese mes
// GET /api/admin/reports?department=<id>                      → todas las filas de ese depto
// GET /api/admin/reports?month=2025-05&department=<id>        → un reporte de ese depto/mes
// GET /api/admin/reports?department=all                       → TODAS las filas (global + deptos)
export async function GET(req: NextRequest) {
  const auth = await getEffectiveUser(req)
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const month = req.nextUrl.searchParams.get("month")
  const deptParam = parseDeptParam(req.nextUrl.searchParams.get("department"))
  const db = createServiceClient()

  if (month) {
    const monthStart = month.length === 7 ? `${month}-01` : month
    let q = db.from("monthly_reports").select("*").eq("month", monthStart)
    if (deptParam === "global") q = q.is("department_id", null)
    else if (deptParam !== "all") q = q.eq("department_id", deptParam)

    const { data, error } = deptParam === "all" ? await q : await q.maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(deptParam === "all" ? { reports: data ?? [] } : { report: data })
  }

  let q = db.from("monthly_reports").select("*").order("month", { ascending: false })
  if (deptParam === "global") q = q.is("department_id", null)
  else if (deptParam !== "all") q = q.eq("department_id", deptParam)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}

// POST /api/admin/reports — upsert a report.
// Body: { month: "YYYY-MM" | "YYYY-MM-01", department_id?: string | null, ...metrics }
// Si department_id está ausente o null → upsertea la fila GLOBAL.
// Si está → upsertea esa fila del depto.
export async function POST(req: NextRequest) {
  const auth = await getEffectiveUser(req)
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (!isAdminOrAbove(auth.effectiveUser.role)) {
    return NextResponse.json({ error: "Solo admins pueden cargar reportes" }, { status: 403 })
  }

  const body = await req.json()
  if (!body?.month) return NextResponse.json({ error: "month requerido (YYYY-MM)" }, { status: 400 })

  const monthStart = body.month.length === 7 ? `${body.month}-01` : body.month
  const departmentId: string | null = body.department_id ?? null
  const fields = sanitize(body)

  const db = createServiceClient()

  // Upsert manual: buscar primero, después insert o update. Necesario porque
  // tenemos dos índices únicos parciales (no un compound clásico).
  const existingQ = db.from("monthly_reports").select("id").eq("month", monthStart)
  const { data: existing } = departmentId
    ? await existingQ.eq("department_id", departmentId).maybeSingle()
    : await existingQ.is("department_id", null).maybeSingle()

  if (existing) {
    const { data, error } = await db
      .from("monthly_reports")
      .update(fields)
      .eq("id", existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ report: data })
  } else {
    const { data, error } = await db
      .from("monthly_reports")
      .insert({ month: monthStart, department_id: departmentId, ...fields })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ report: data })
  }
}

// DELETE /api/admin/reports — by id, or by (month + optional department).
export async function DELETE(req: NextRequest) {
  const auth = await getEffectiveUser(req)
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id    = body?.id
  const month = body?.month
  const departmentId: string | null | undefined = body?.department_id

  if (!id && !month) {
    return NextResponse.json({ error: "id o month requerido" }, { status: 400 })
  }

  const db = createServiceClient()
  let q = db.from("monthly_reports").delete()
  if (id) q = q.eq("id", id)
  else {
    q = q.eq("month", month.length === 7 ? `${month}-01` : month)
    if (departmentId === undefined || departmentId === null) q = q.is("department_id", null)
    else q = q.eq("department_id", departmentId)
  }
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
