import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

/**
 * Cron endpoint: genera instancias de tareas recurrentes.
 *
 * Lo llama Vercel Cron con header `Authorization: Bearer <CRON_SECRET>`
 * (configurar en vercel.json) o se puede invocar manualmente.
 *
 * Reglas soportadas en `recurrence_rule`:
 *   - "daily"
 *   - "weekly"
 *   - "monthly"
 *
 * Cada vez que corre, para cada template:
 *   - Calcula cuándo debería haber sido la próxima instancia (basado en
 *     last_generated_at o created_at del template).
 *   - Si esa fecha ya pasó (o es hoy), crea una instancia nueva de la
 *     tarea con status "pendiente" y due_at = el día calculado a las
 *     18:00 hora local.
 *   - Actualiza last_generated_at del template.
 *   - Si recurrence_until ya pasó, no genera más.
 */

interface RecurringTemplate {
  id:                    string
  title:                 string
  description:           string | null
  priority:              string
  tags:                  string[]
  assignees:             string[]
  recurrence_rule:       string
  recurrence_until:      string | null
  last_generated_at:     string | null
  created_at:            string
  parent_id:             string | null
  status_set_id:         string | null
}

function nextDueDate(rule: string, baseline: Date): Date | null {
  const next = new Date(baseline)
  switch (rule) {
    case "daily":   next.setUTCDate(next.getUTCDate() + 1); break
    case "weekly":  next.setUTCDate(next.getUTCDate() + 7); break
    case "monthly": next.setUTCMonth(next.getUTCMonth() + 1); break
    default: return null
  }
  return next
}

export async function GET(req: NextRequest) {
  // Auth: Vercel Cron passes Authorization header with CRON_SECRET
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const db = createServiceClient()
  const now = new Date()

  // 1) Pull all active templates
  const { data: templates, error } = await db
    .from("tasks")
    .select("id,title,description,priority,tags,assignees,recurrence_rule,recurrence_until,last_generated_at,created_at,parent_id,status_set_id")
    .eq("is_recurrence_template", true)
    .not("recurrence_rule", "is", null)

  if (error) {
    console.error("[cron/generate-recurring] fetch error", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const generated: any[] = []
  const skipped:   string[] = []

  for (const t of (templates ?? []) as RecurringTemplate[]) {
    // Skip if recurrence_until already passed
    if (t.recurrence_until && new Date(t.recurrence_until) < now) {
      skipped.push(`${t.id}: until reached`)
      continue
    }

    // Determine baseline: last_generated_at or created_at
    const baseline = new Date(t.last_generated_at ?? t.created_at)
    const next = nextDueDate(t.recurrence_rule, baseline)
    if (!next) {
      skipped.push(`${t.id}: invalid rule "${t.recurrence_rule}"`)
      continue
    }

    // Only generate if next due date is in the past or today
    if (next.getTime() > now.getTime() + 86400_000) {
      skipped.push(`${t.id}: next due ${next.toISOString().slice(0,10)} not yet`)
      continue
    }

    // Catch-up: keep generating instances until we're caught up to "now"
    let cursor = baseline
    while (true) {
      const upcoming = nextDueDate(t.recurrence_rule, cursor)
      if (!upcoming) break
      if (upcoming.getTime() > now.getTime() + 86400_000) break
      if (t.recurrence_until && upcoming > new Date(t.recurrence_until)) break

      // Set due_at to 18:00 UTC of the upcoming date
      const dueAt = new Date(upcoming)
      dueAt.setUTCHours(18, 0, 0, 0)

      const { data: inserted, error: iErr } = await db.from("tasks").insert({
        title:        t.title,
        description:  t.description,
        priority:     t.priority,
        tags:         t.tags,
        assignees:    t.assignees,
        due_at:       dueAt.toISOString(),
        status:       "pendiente",
        status_set_id: t.status_set_id,
        // Reference back to template via tag
      }).select("id").single()

      if (iErr) {
        console.error("[cron/generate-recurring] insert error for", t.id, iErr)
        break
      }
      generated.push({ template_id: t.id, instance_id: inserted!.id, due_at: dueAt.toISOString() })
      cursor = upcoming
    }

    // Update template's last_generated_at
    if (cursor.getTime() !== baseline.getTime()) {
      await db.from("tasks")
        .update({ last_generated_at: cursor.toISOString() })
        .eq("id", t.id)
    }
  }

  return NextResponse.json({
    ok:        true,
    generated: generated.length,
    skipped:   skipped.length,
    detail:    { generated, skipped },
    now:       now.toISOString(),
  })
}
