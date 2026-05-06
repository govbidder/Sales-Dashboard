import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { sendEmail, digestEmail } from "@/lib/email"

/**
 * Email digest cron: una vez al día agrupa las notificaciones no leídas
 * de cada usuario y le manda un email-resumen.
 *
 * Vercel Cron lo llama con header `Authorization: Bearer <CRON_SECRET>`.
 * Si Resend no está configurado, retorna 200 sin enviar (degrada gracefully).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: "RESEND_API_KEY no configurada" })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sales-dashboard-zeta-rose.vercel.app"

  const db = createServiceClient()
  // Get all unread notifications, grouped by recipient
  const { data: notifs, error } = await db
    .from("notifications")
    .select("recipient,kind,read_at")
    .is("read_at", null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by recipient
  const byRecipient = new Map<string, { task_assigned: number; task_mention: number; task_overdue: number }>()
  for (const n of (notifs ?? []) as any[]) {
    if (!n.recipient) continue
    const buckets = byRecipient.get(n.recipient) ?? { task_assigned: 0, task_mention: 0, task_overdue: 0 }
    if (n.kind === "task_assigned") buckets.task_assigned++
    if (n.kind === "task_mention")  buckets.task_mention++
    if (n.kind === "task_overdue")  buckets.task_overdue++
    byRecipient.set(n.recipient, buckets)
  }

  // Look up profile names
  const emails = Array.from(byRecipient.keys())
  if (!emails.length) return NextResponse.json({ ok: true, sent: 0, recipients: 0 })

  const { data: profiles } = await db
    .from("profiles")
    .select("email,full_name")
    .in("email", emails)
  const nameByEmail = new Map<string, string>()
  for (const p of (profiles ?? []) as any[]) {
    if (p.email) nameByEmail.set(p.email, p.full_name ?? p.email.split("@")[0])
  }

  // Send
  const results: { recipient: string; ok: boolean; id?: string; error?: string }[] = []
  for (const [recipient, itemsByKind] of byRecipient.entries()) {
    const total = itemsByKind.task_assigned + itemsByKind.task_mention + itemsByKind.task_overdue
    if (total === 0) continue
    const tpl = digestEmail({
      appUrl,
      recipientName: nameByEmail.get(recipient),
      itemsByKind,
    })
    const r = await sendEmail({ to: recipient, subject: tpl.subject, text: tpl.text, html: tpl.html })
    results.push({ recipient, ...r })
  }

  return NextResponse.json({
    ok:         true,
    recipients: byRecipient.size,
    sent:       results.filter(r => r.ok).length,
    failed:     results.filter(r => !r.ok).length,
    detail:     results,
  })
}
