import { Resend } from "resend"

const fromAddress = process.env.RESEND_FROM ?? "GovBidder <notifications@govbidder.com>"

let client: Resend | null = null
function getClient(): Resend | null {
  if (client) return client
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  client = new Resend(key)
  return client
}

export interface EmailPayload {
  to:        string | string[]
  subject:   string
  /** Plain text fallback. Required for deliverability. */
  text:      string
  /** HTML body. */
  html:      string
}

export interface EmailResult {
  ok:        boolean
  id?:       string
  error?:    string
}

/**
 * Send an email via Resend. Returns { ok: false } if Resend isn't configured
 * (so callers can degrade gracefully without throwing).
 */
export async function sendEmail(p: EmailPayload): Promise<EmailResult> {
  const c = getClient()
  if (!c) return { ok: false, error: "RESEND_API_KEY no configurada" }

  try {
    const { data, error } = await c.emails.send({
      from:    fromAddress,
      to:      Array.isArray(p.to) ? p.to : [p.to],
      subject: p.subject,
      text:    p.text,
      html:    p.html,
    })
    if (error) return { ok: false, error: error.message ?? "Error de Resend" }
    return { ok: true, id: data?.id }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Error desconocido" }
  }
}

/* ─── Templates ──────────────────────────────────────────────────────────── */

interface BaseTemplateOpts {
  recipientName?: string
  appUrl:         string  // base URL of the dashboard, ej "https://sales-dashboard-zeta-rose.vercel.app"
}

export function taskAssignedEmail(opts: BaseTemplateOpts & {
  assignedBy?: string
  taskTitle:   string
  taskHref:    string
}): { subject: string; text: string; html: string } {
  const greeting = opts.recipientName ? `Hola ${opts.recipientName}` : "Hola"
  const subject  = `Nueva tarea asignada: ${opts.taskTitle}`
  const text = `${greeting},\n\n${opts.assignedBy ?? "Alguien"} te asignó una tarea nueva: "${opts.taskTitle}".\n\nVer la tarea: ${opts.taskHref}\n\n— GovBidder`
  const html = htmlWrapper(`
    <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">Nueva tarea asignada</h1>
    <p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.6;">
      ${greeting}, ${opts.assignedBy ?? "alguien"} te asignó la siguiente tarea:
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:15px;font-weight:bold;color:#0f172a;">${escapeHtml(opts.taskTitle)}</p>
    </div>
    <a href="${opts.taskHref}" style="display:inline-block;background:#E42D2C;color:#fff;text-decoration:none;font-weight:bold;padding:10px 20px;border-radius:9999px;font-size:13px;">
      Ver tarea →
    </a>
  `, opts.appUrl)
  return { subject, text, html }
}

export function digestEmail(opts: BaseTemplateOpts & {
  itemsByKind: { task_assigned: number; task_mention: number; task_overdue: number }
}): { subject: string; text: string; html: string } {
  const total = opts.itemsByKind.task_assigned + opts.itemsByKind.task_mention + opts.itemsByKind.task_overdue
  const subject = `${total} actualizaciones en tu dashboard de hoy`
  const text = `Tenés ${total} actualizaciones nuevas:\n` +
    `- ${opts.itemsByKind.task_assigned} tareas asignadas\n` +
    `- ${opts.itemsByKind.task_mention} comentarios\n` +
    `- ${opts.itemsByKind.task_overdue} tareas vencidas\n\n` +
    `Ver todo: ${opts.appUrl}/inicio\n\n— GovBidder`
  const html = htmlWrapper(`
    <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">Tu resumen de hoy</h1>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      ${total} actualizaciones que necesitan tu atención:
    </p>
    <ul style="list-style:none;padding:0;margin:0 0 20px;">
      <li style="padding:10px 14px;background:#f1f5f9;border-radius:8px;margin-bottom:6px;font-size:13.5px;color:#0f172a;">
        <strong>${opts.itemsByKind.task_assigned}</strong> tareas asignadas
      </li>
      <li style="padding:10px 14px;background:#fffbeb;border-radius:8px;margin-bottom:6px;font-size:13.5px;color:#0f172a;">
        <strong>${opts.itemsByKind.task_mention}</strong> comentarios
      </li>
      <li style="padding:10px 14px;background:#fef2f2;border-radius:8px;margin-bottom:6px;font-size:13.5px;color:#0f172a;">
        <strong>${opts.itemsByKind.task_overdue}</strong> tareas vencidas
      </li>
    </ul>
    <a href="${opts.appUrl}/inicio" style="display:inline-block;background:#E42D2C;color:#fff;text-decoration:none;font-weight:bold;padding:10px 20px;border-radius:9999px;font-size:13px;">
      Ver dashboard →
    </a>
  `, opts.appUrl)
  return { subject, text, html }
}

/* ─── HTML wrapper (minimal, email-client-safe) ──────────────────────────── */

function htmlWrapper(content: string, appUrl: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;">
    <div style="margin-bottom:24px;">
      <span style="display:inline-block;font-size:11px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;color:#1e3a8a;">GovBidder</span>
    </div>
    ${content}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
    <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
      Este email se generó automáticamente. Para gestionar notificaciones, visitá tu perfil en
      <a href="${appUrl}" style="color:#1e3a8a;">${appUrl.replace(/^https?:\/\//, "")}</a>.
    </p>
  </div>
</body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
