import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

const NUMERIC_FIELDS = [
  "total_revenue", "cash_collected", "mrr", "ad_spend", "software_costs", "variable_costs",
  "scheduled_calls", "attended_calls", "qualified_calls", "no_show", "open_conversations",
  "aplications", "inbound_messages",
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

// GET /api/admin/reports                → all reports
// GET /api/admin/reports?month=2025-05   → single report
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const month = req.nextUrl.searchParams.get("month")
  const db = createServiceClient()

  if (month) {
    const monthStart = month.length === 7 ? `${month}-01` : month
    const { data, error } = await db
      .from("monthly_reports")
      .select("*")
      .eq("month", monthStart)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ report: data })
  }

  const { data, error } = await db
    .from("monthly_reports")
    .select("*")
    .order("month", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}

// POST /api/admin/reports — upsert a report by month
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  if (!body?.month) return NextResponse.json({ error: "month requerido (YYYY-MM)" }, { status: 400 })

  const monthStart = body.month.length === 7 ? `${body.month}-01` : body.month
  const fields = sanitize(body)

  const db = createServiceClient()
  const { data, error } = await db
    .from("monthly_reports")
    .upsert({ month: monthStart, ...fields }, { onConflict: "month" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ report: data })
}

// DELETE /api/admin/reports — by id or month
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id    = body?.id
  const month = body?.month

  if (!id && !month) {
    return NextResponse.json({ error: "id o month requerido" }, { status: 400 })
  }

  const db = createServiceClient()
  const query = db.from("monthly_reports").delete()
  const { error } = await (id ? query.eq("id", id) : query.eq("month", month.length === 7 ? `${month}-01` : month))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
