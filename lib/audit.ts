import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

interface AuditLogEntry {
  actor:      string | null
  actor_role?: string | null
  action:     string         // "task.delete", "form.create", etc.
  entity:     string         // "task", "form", "persona", etc.
  entity_id?: string | null
  payload?:   Record<string, any>
  ip?:        string | null
  user_agent?: string | null
}

/**
 * Inserta una entrada al audit_log. Fire-and-forget — nunca tira excepciones
 * que rompan el flujo del endpoint que llama.
 *
 * Si la tabla audit_log no existe (migration no aplicada), falla silenciosamente.
 */
export async function audit(req: NextRequest, entry: AuditLogEntry): Promise<void> {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
    const ua = req.headers.get("user-agent") ?? null

    const db = createServiceClient()
    await db.from("audit_log").insert({
      actor:      entry.actor,
      actor_role: entry.actor_role ?? null,
      action:     entry.action,
      entity:     entry.entity,
      entity_id:  entry.entity_id ?? null,
      payload:    entry.payload ?? {},
      ip:         entry.ip ?? ip,
      user_agent: entry.user_agent ?? ua,
    })
  } catch (e: any) {
    // Audit failures should never break the calling endpoint
    console.error("[audit] failed to write entry", e?.message ?? e)
  }
}
