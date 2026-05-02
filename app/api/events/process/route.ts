import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

// Process pending outbound_events — call this from a cron or webhook trigger
export async function POST(req: NextRequest) {
  // Simple secret check to prevent unauthorized triggers
  const secret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "")
  const expectedSecret = process.env.CRON_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const db = createServiceClient()

  // Fetch up to 20 pending events that are due
  const { data: events, error } = await db
    .from("outbound_events")
    .select("*")
    .eq("status", "pending")
    .lte("next_retry_at", new Date().toISOString())
    .order("created_at")
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!events?.length) return NextResponse.json({ processed: 0, message: "No hay eventos pendientes" })

  let processed = 0
  let failed = 0

  for (const event of events) {
    try {
      // Mark as processing
      await db.from("outbound_events").update({
        status: "processing",
        attempts: (event.attempts ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", event.id)

      // Handle event types
      await handleEvent(event)

      // Mark as completed
      await db.from("outbound_events").update({
        status: "completed",
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", event.id)

      processed++
    } catch (err: any) {
      failed++
      const attempts = (event.attempts ?? 0) + 1
      const maxAttempts = event.max_attempts ?? 3
      const nextRetry = new Date(Date.now() + Math.pow(2, attempts) * 60 * 1000).toISOString()

      await db.from("outbound_events").update({
        status: attempts >= maxAttempts ? "failed" : "pending",
        error_message: err?.message ?? "Error desconocido",
        next_retry_at: nextRetry,
        updated_at: new Date().toISOString(),
      }).eq("id", event.id)
    }
  }

  return NextResponse.json({ processed, failed, total: events.length })
}

async function handleEvent(event: Record<string, unknown>) {
  const type = event.event_type as string
  const payload = event.payload as Record<string, unknown>

  switch (type) {
    case "monthly_report.completed":
      // Future: send Slack/email notification
      break
    case "sale.registered":
      // Future: sync to CRM / send notification
      break
    case "airtable.sync":
      // Future: sync data to Airtable
      break
    default:
      // Log unknown event types but don't fail
      console.log(`[events] Unknown event type: ${type}`, payload)
  }
}

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from("outbound_events")
    .select("id, event_type, status, attempts, created_at, error_message")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data ?? [] })
}
