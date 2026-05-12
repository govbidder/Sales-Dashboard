/**
 * Tipos y constantes compartidos del módulo tasks.
 *
 * Antes vivían inline en tasks-view.tsx (2613 líneas). Extraídos para
 * que otros archivos del módulo (board-column, task-card, drawers,
 * bulk-bar) puedan tiparlos sin importar el monolito.
 */

export const PRIORITY_OPTIONS  = ["baja", "media", "alta", "urgente"] as const
export const FALLBACK_STATUSES = ["pendiente", "en_progreso", "completada", "cancelada"] as const

export type Status   = string
export type Priority = typeof PRIORITY_OPTIONS[number]
export type ViewMode = "board" | "list" | "calendar"
export type GroupBy  = "status" | "assignee" | "priority" | "tag" | "department" | "none"
export type SortBy   = "due_at" | "priority" | "created_at" | "title"

export interface StatusDef {
  key:      string
  label:    string
  color:    string
  terminal: boolean
}

export interface StatusSet {
  id:          string
  name:        string
  description: string | null
  is_default:  boolean
  statuses:    StatusDef[]
}

export interface Task {
  id:           string
  title:        string
  description:  string | null
  status:       Status
  priority:     Priority
  owner:        string | null
  assignees:    string[]
  tags:         string[]
  due_at:       string | null
  completed_at: string | null
  persona_id:   string | null
  parent_id:    string | null
  created_by:   string | null
  created_at:   string
  updated_at:   string
  department_id: string | null
}

export interface TaskComment {
  id:         string
  task_id:    string
  author:     string | null
  content:    string
  kind:       "comment" | "system"
  created_at: string
}

export interface PersonaLite { id: string; name: string }

export interface SavedView {
  id:               string
  name:             string
  search:           string
  filterPriority:   string
  filterAssignee:   string
  filterTag:        string
  filterDepartment: string
  quickFilter:      string
  sortBy:           string
  view:             ViewMode
}

export const SAVED_VIEWS_KEY = "tasksSavedViews_v1"

// Default fallback set usado hasta que la API responde (evita flash).
export const DEFAULT_STATUS_SET: StatusSet = {
  id:          "_default_local",
  name:        "Default",
  description: null,
  is_default:  true,
  statuses: [
    { key: "pendiente",   label: "Pendiente",   color: "#94a3b8", terminal: false },
    { key: "en_progreso", label: "En progreso", color: "#1e3a8a", terminal: false },
    { key: "completada",  label: "Completada",  color: "#10b981", terminal: true  },
    { key: "cancelada",   label: "Cancelada",   color: "#71717a", terminal: true  },
  ],
}

export const PRIORITY_STYLE: Record<Priority, { flag: string; pill: string; weight: number }> = {
  baja:    { flag: "text-zinc-500",   pill: "text-zinc-700  border-zinc-300  bg-zinc-50",       weight: 1 },
  media:   { flag: "text-amber-600",  pill: "text-amber-800 border-amber-300 bg-amber-50",      weight: 2 },
  alta:    { flag: "text-orange-600", pill: "text-orange-800 border-orange-300 bg-orange-50",   weight: 3 },
  urgente: { flag: "text-[#E42D2C]",  pill: "text-[#E42D2C] border-red-300   bg-red-50",        weight: 4 },
}

/** Reusable input class (forms, drawers, modales del módulo tasks). */
export const TASK_INPUT_CLS =
  "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-[#1e3a8a]/40 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/10 transition-all"
