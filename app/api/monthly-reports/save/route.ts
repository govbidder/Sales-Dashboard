import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { client_id, month, ...fields } = body

  if (!client_id || !month) {
    return NextResponse.json({ error: "client_id y month son requeridos" }, { status: 400 })
  }

  // Normalize month to YYYY-MM-01
  const monthDate = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month

  // Cast numeric fields
  const numericFields = [
    "total_revenue","cash_collected","mrr","ad_spend","software_costs","variable_costs",
    "scheduled_calls","attended_calls","qualified_calls","aplications","inbound_messages",
    "offer_docs_sent","offer_docs_responded","cierres_por_offerdoc","new_clients","active_clients",
    "short_followers","short_reach","short_posts",
    "yt_subscribers","yt_new_subscribers","yt_monthly_audience","yt_views","yt_watch_time","yt_videos",
    "email_subscribers","email_new_subscribers","nps_score",
  ]

  const row: Record<string, any> = { client_id, month: monthDate, updated_at: new Date().toISOString() }
  for (const [k, v] of Object.entries(fields)) {
    if (v === "" || v === null || v === undefined) continue
    row[k] = numericFields.includes(k) ? Number(v) : v
  }

  const db = createServiceClient()
  const { data: report, error } = await db
    .from("monthly_reports")
    .upsert(row, { onConflict: "client_id,month" })
    .select()
    .single()

  if (error) {
    console.error("[monthly-reports/save]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ report, events_enqueued: 0 })
}
