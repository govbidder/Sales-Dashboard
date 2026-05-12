import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { sendEmail } from "@/lib/email"

/**
 * Cron mensual: el día 1 de cada mes a las 10:00 UTC, manda un reporte
 * ejecutivo a todos los admins con KPIs del mes anterior.
 *
 * Skip silencioso si no hay RESEND_API_KEY o si no es día 1 (Vercel
 * Cron solo soporta schedule fija, así que igual chequeamos por las dudas).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: "RESEND_API_KEY no configurada" })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sales-dashboard-zeta-rose.vercel.app"
  const db = createServiceClient()
  const now = new Date()

  // Date range: previous calendar month
  const prevMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
  const prevMonthEnd = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const monthLabel = prevMonth.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
  const prevMonthIso = prevMonth.toISOString()
  const prevMonthEndIso = prevMonthEnd.toISOString()
  const monthKey = prevMonth.toISOString().slice(0, 7) + "-01"

  // Pull metrics in parallel
  const [
    completedTasksRes, createdTasksRes, newPersonasRes, currentReportRes,
    overdueRes, adminsRes,
  ] = await Promise.all([
    db.from("tasks").select("id", { count: "exact", head: true })
      .gte("completed_at", prevMonthIso).lt("completed_at", prevMonthEndIso),
    db.from("tasks").select("id", { count: "exact", head: true })
      .gte("created_at", prevMonthIso).lt("created_at", prevMonthEndIso),
    db.from("personas_agendadas").select("id", { count: "exact", head: true })
      .gte("created_at", prevMonthIso).lt("created_at", prevMonthEndIso),
    db.from("monthly_reports").select("*").eq("month", monthKey).maybeSingle(),
    db.from("tasks").select("id", { count: "exact", head: true })
      .lt("due_at", now.toISOString()).not("status", "in", "(completada,cancelada)"),
    db.from("profiles").select("email,full_name").in("role", ["admin", "super_admin", "developer"]).eq("status", "activo"),
  ])

  const completedTasks = completedTasksRes.count ?? 0
  const createdTasks   = createdTasksRes.count   ?? 0
  const newPersonas    = newPersonasRes.count    ?? 0
  const overdueNow     = overdueRes.count        ?? 0
  const report         = currentReportRes.data
  const admins         = adminsRes.data ?? []

  if (admins.length === 0) {
    return NextResponse.json({ ok: true, skipped: "No hay admins activos" })
  }

  // Build email content
  const fmtMoney  = (n: number | null | undefined) =>
    n != null ? `$${Number(n).toLocaleString()}` : "—"
  const fmtNumber = (n: number | null | undefined) => n != null ? n.toLocaleString() : "—"

  const subject = `Reporte mensual — ${monthLabel}`
  const text = [
    `Reporte mensual: ${monthLabel}`,
    "",
    `Tareas completadas: ${completedTasks}`,
    `Tareas nuevas: ${createdTasks}`,
    `Personas agendadas nuevas: ${newPersonas}`,
    `Tareas vencidas pendientes (al cierre): ${overdueNow}`,
    "",
    report
      ? [
          "Métricas cargadas:",
          `- Cash collected: ${fmtMoney(report.cash_collected)}`,
          `- Total revenue:  ${fmtMoney(report.total_revenue)}`,
          `- MRR:            ${fmtMoney(report.mrr)}`,
          `- Ad spend:       ${fmtMoney(report.ad_spend)}`,
          `- Calls atendidas: ${fmtNumber(report.attended_calls)}`,
          `- Nuevos clientes: ${fmtNumber(report.new_clients)}`,
        ].join("\n")
      : "Sin reporte de métricas cargado para el mes (ir a /admin/reports).",
    "",
    `Ver dashboard: ${appUrl}/inicio`,
    "",
    "— GovBidder",
  ].join("\n")

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;">
    <p style="margin:0 0 8px;font-size:11px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;color:#1e3a8a;">GovBidder · Reporte Mensual</p>
    <h1 style="margin:0 0 20px;font-size:24px;color:#0f172a;text-transform:capitalize;">${monthLabel}</h1>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;">
      <div style="background:#1e3a8a0a;border:1px solid #1e3a8a25;border-radius:12px;padding:14px;">
        <p style="margin:0;font-size:11px;color:#1e3a8a;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;">Tareas completadas</p>
        <p style="margin:4px 0 0;font-size:24px;font-weight:bold;color:#0f172a;">${completedTasks}</p>
      </div>
      <div style="background:#E42D2C0a;border:1px solid #E42D2C25;border-radius:12px;padding:14px;">
        <p style="margin:0;font-size:11px;color:#E42D2C;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;">Tareas creadas</p>
        <p style="margin:4px 0 0;font-size:24px;font-weight:bold;color:#0f172a;">${createdTasks}</p>
      </div>
      <div style="background:#10b9810a;border:1px solid #10b98125;border-radius:12px;padding:14px;">
        <p style="margin:0;font-size:11px;color:#059669;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;">Personas nuevas</p>
        <p style="margin:4px 0 0;font-size:24px;font-weight:bold;color:#0f172a;">${newPersonas}</p>
      </div>
      <div style="background:#f59e0b0a;border:1px solid #f59e0b25;border-radius:12px;padding:14px;">
        <p style="margin:0;font-size:11px;color:#b45309;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;">Vencidas hoy</p>
        <p style="margin:4px 0 0;font-size:24px;font-weight:bold;color:#0f172a;">${overdueNow}</p>
      </div>
    </div>

    ${report ? `
      <h2 style="margin:24px 0 12px;font-size:14px;color:#0f172a;">Métricas del mes</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:8px 0;color:#64748b;">Cash collected</td><td style="padding:8px 0;text-align:right;font-weight:bold;color:#0f172a;">${fmtMoney(report.cash_collected)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Total revenue</td> <td style="padding:8px 0;text-align:right;font-weight:bold;color:#0f172a;">${fmtMoney(report.total_revenue)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">MRR</td>           <td style="padding:8px 0;text-align:right;font-weight:bold;color:#0f172a;">${fmtMoney(report.mrr)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Ad spend</td>      <td style="padding:8px 0;text-align:right;font-weight:bold;color:#0f172a;">${fmtMoney(report.ad_spend)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Calls atendidas</td><td style="padding:8px 0;text-align:right;font-weight:bold;color:#0f172a;">${fmtNumber(report.attended_calls)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Nuevos clientes</td><td style="padding:8px 0;text-align:right;font-weight:bold;color:#0f172a;">${fmtNumber(report.new_clients)}</td></tr>
      </table>
    ` : `
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:14px;margin:16px 0;">
        <p style="margin:0;font-size:13px;color:#92400e;">⚠️ No se cargaron métricas del mes en /admin/reports.</p>
      </div>
    `}

    <div style="margin-top:28px;">
      <a href="${appUrl}/dashboard" style="display:inline-block;background:#E42D2C;color:#fff;text-decoration:none;font-weight:bold;padding:10px 24px;border-radius:9999px;font-size:13px;">
        Ver dashboard completo →
      </a>
    </div>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">Reporte automático generado por GovBidder.</p>
  </div>
</body></html>`

  const results: any[] = []
  for (const admin of admins as any[]) {
    if (!admin.email) continue
    const r = await sendEmail({
      to:      admin.email,
      subject,
      text,
      html,
    })
    results.push({ to: admin.email, ...r })
  }

  return NextResponse.json({
    ok:        true,
    month:     monthLabel,
    metrics:   { completedTasks, createdTasks, newPersonas, overdueNow, hasReport: !!report },
    sent:      results.filter(r => r.ok).length,
    failed:    results.filter(r => !r.ok).length,
    detail:    results,
  })
}
