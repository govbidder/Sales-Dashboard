import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

// Returns an aggregated "health snapshot" of the whole dashboard.
// Used by the Inicio page to show what needs attention.
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()
  const now = new Date()
  const nowIso = now.toISOString()

  const STALE_DAYS = 7
  const staleCutoff = new Date(now.getTime() - STALE_DAYS * 86400_000).toISOString()

  const currentMonth      = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`
  const prevMonthDate     = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const previousMonth     = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, "0")}-01`

  const [
    overdueTasksRes,
    pendingTasksRes,
    personasRes,
    seguimientosRes,
    currentReportRes,
    previousReportRes,
    teamRes,
  ] = await Promise.all([
    // Overdue tasks (due in the past, not completed/cancelled)
    db.from("tasks")
      .select("id, title, priority, owner, assignees, due_at, persona_id")
      .lt("due_at", nowIso)
      .not("status", "in", "(completada,cancelada)")
      .order("due_at", { ascending: true })
      .limit(50),

    // Pending tasks count
    db.from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendiente"),

    // All personas (we'll cross-reference with seguimientos to find stale ones)
    db.from("personas_agendadas")
      .select("id, name, scheduled_at, call_status, sales_status, owner, created_at")
      .order("created_at", { ascending: false }),

    // All seguimientos to compute "last contact" per persona
    db.from("seguimientos")
      .select("persona_id, created_at"),

    // Current month report
    db.from("monthly_reports")
      .select("*")
      .eq("month", currentMonth)
      .maybeSingle(),

    // Previous month report (for trend comparison)
    db.from("monthly_reports")
      .select("*")
      .eq("month", previousMonth)
      .maybeSingle(),

    // Team count
    db.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "activo"),
  ])

  const overdueTasks = overdueTasksRes.data ?? []
  const personas     = personasRes.data ?? []
  const seguimientos = seguimientosRes.data ?? []
  const currentReport  = currentReportRes.data
  const previousReport = previousReportRes.data

  // ── Compute "personas sin seguimiento" ──────────────────────────────────────
  // Group seguimientos by persona_id, take latest created_at per persona
  const lastContact = new Map<string, string>()
  for (const s of seguimientos) {
    if (!s.persona_id) continue
    const prev = lastContact.get(s.persona_id)
    if (!prev || s.created_at > prev) {
      lastContact.set(s.persona_id, s.created_at)
    }
  }

  // A persona is "stale" if:
  // - Sales status is still pendiente or propuesta (not closed/lost)
  // - AND last contact (or created_at if no seguimiento) is older than STALE_DAYS
  const stalePersonas = personas
    .filter((p: any) => p.sales_status === "pendiente" || p.sales_status === "propuesta")
    .map((p: any) => {
      const last = lastContact.get(p.id) ?? p.created_at
      return { ...p, last_contact: last }
    })
    .filter((p: any) => p.last_contact < staleCutoff)
    .sort((a: any, b: any) => a.last_contact.localeCompare(b.last_contact))

  // ── Detect declining metrics ────────────────────────────────────────────────
  const TRACKED_FOR_TREND: Array<{ key: string; label: string; format: "money" | "number" }> = [
    { key: "cash_collected",  label: "Cobrado",          format: "money" },
    { key: "total_revenue",   label: "Ingresos Totales", format: "money" },
    { key: "mrr",             label: "MRR",              format: "money" },
    { key: "new_clients",     label: "Nuevos Clientes",  format: "number" },
    { key: "attended_calls",  label: "Llamadas Atendidas", format: "number" },
    { key: "scheduled_calls", label: "Llamadas Agendadas", format: "number" },
  ]

  const declining: Array<{ key: string; label: string; current: number; previous: number; pct: number; format: "money" | "number" }> = []
  const improving: Array<{ key: string; label: string; current: number; previous: number; pct: number; format: "money" | "number" }> = []

  if (currentReport && previousReport) {
    for (const m of TRACKED_FOR_TREND) {
      const cur  = Number(currentReport[m.key])  || 0
      const prev = Number(previousReport[m.key]) || 0
      if (!prev || !cur) continue
      const pct = ((cur - prev) / prev) * 100
      // Significant change threshold: 15%
      if (pct <= -15) {
        declining.push({ key: m.key, label: m.label, current: cur, previous: prev, pct, format: m.format })
      } else if (pct >= 15) {
        improving.push({ key: m.key, label: m.label, current: cur, previous: prev, pct, format: m.format })
      }
    }
  }

  // Sort declining: worst first
  declining.sort((a, b) => a.pct - b.pct)
  improving.sort((a, b) => b.pct - a.pct)

  // ── Build response ──────────────────────────────────────────────────────────
  const issuesCount =
    overdueTasks.length +
    stalePersonas.length +
    (currentReport ? 0 : 1) +
    declining.length

  return NextResponse.json({
    issuesCount,
    counts: {
      overdueTasks:    overdueTasks.length,
      pendingTasks:    pendingTasksRes.count ?? 0,
      stalePersonas:   stalePersonas.length,
      activePersonas:  personas.filter((p: any) => p.sales_status === "pendiente" || p.sales_status === "propuesta").length,
      teamMembers:     teamRes.count ?? 0,
      decliningMetrics: declining.length,
      improvingMetrics: improving.length,
    },
    overdueTasks,
    stalePersonas: stalePersonas.slice(0, 10),
    missingCurrentReport: !currentReport,
    currentMonth: currentMonth.slice(0, 7),
    previousMonth: previousMonth.slice(0, 7),
    declining,
    improving,
  })
}
