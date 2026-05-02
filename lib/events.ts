import { createServiceClient } from "@/lib/supabase-service"

export type EventType =
  | "monthly_report.completed"
  | "sale.registered"
  | "airtable.sync"
  | "client.created"
  | "lead.created"
  | "payment.received"

export interface EventPayload {
  [key: string]: unknown
}

export interface EnqueueEventOptions {
  type: EventType
  payload?: EventPayload
  clientId?: string
  userId?: string
}

export async function enqueueEvent({ type, payload = {}, clientId, userId }: EnqueueEventOptions): Promise<string> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("outbound_events")
    .insert({
      event_type: type,
      payload,
      client_id: clientId ?? null,
      user_id:   userId ?? null,
      status:    "pending",
    })
    .select("id")
    .single()

  if (error) throw new Error(error.message)
  return data.id
}

export async function enqueueEvents(events: EnqueueEventOptions[]): Promise<string[]> {
  if (!events.length) return []
  const ids: string[] = []
  for (const e of events) {
    const id = await enqueueEvent(e)
    ids.push(id)
  }
  return ids
}

export async function fireEventDispatcher(): Promise<void> {
  // Trigger the /api/events/process endpoint
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000"

  await fetch(`${baseUrl}/api/events/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.CRON_SECRET ? { "x-cron-secret": process.env.CRON_SECRET } : {}),
    },
  }).catch(() => { /* non-critical */ })
}
