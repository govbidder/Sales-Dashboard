/**
 * Helper functions del módulo tasks — pure functions, sin React.
 *
 * Extraídas de tasks-view.tsx (antes 2613 líneas). Reusable desde
 * cualquier sub-componente (task-card, board-column, drawers, bulk-bar).
 */

import type { Task } from "./_types"

export function fmtDateTime(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleString("es-AR", {
    day:    "numeric",
    month:  "short",
    hour:   "2-digit",
    minute: "2-digit",
  })
}

export function fmtRelative(iso: string): string {
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  const min = Math.floor(diff / 60_000)
  if (min < 1)  return "ahora"
  if (min < 60) return `hace ${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24)  return `hace ${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7)  return `hace ${day}d`
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

export function toLocalInputValue(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

export const FALLBACK_TERMINAL = new Set(["completada", "cancelada"])

export function isTerminal(status: string, terminalKeys: Set<string> = FALLBACK_TERMINAL): boolean {
  return terminalKeys.has(status)
}

export function isOverdue(t: Task, terminalKeys: Set<string> = FALLBACK_TERMINAL): boolean {
  if (!t.due_at) return false
  if (isTerminal(t.status, terminalKeys)) return false
  return new Date(t.due_at).getTime() < Date.now()
}

export function isDueThisWeek(t: Task, terminalKeys: Set<string> = FALLBACK_TERMINAL): boolean {
  if (!t.due_at) return false
  if (isTerminal(t.status, terminalKeys)) return false
  const d   = new Date(t.due_at).getTime()
  const now = Date.now()
  const in7 = now + 7 * 24 * 3600_000
  return d >= now && d <= in7
}

export function initials(s: string): string {
  return s.split(/[\s@]/).map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
}

/** Hex color → inline pill style (bg/text/border) usando alpha mixing. */
export function statusInlineStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: color + "10",
    borderColor:     color + "40",
    color:           color,
  }
}
