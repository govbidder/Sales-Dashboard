"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Portal } from "@/components/ui/portal"
import { CalendarView } from "@/components/views/tasks/calendar-view"
import { AiExtractModal } from "@/components/views/tasks/ai-extract-modal"
import { TemplatesModal } from "@/components/views/tasks/templates-modal"
import { exportToCSV, csvDate } from "@/lib/export-csv"
import type { Department } from "@/lib/types/department"
import { CsvImportModal } from "@/components/ui/csv-import-modal"
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  closestCenter,
} from "@dnd-kit/core"
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Loader2, Trash2, RefreshCw, Plus, X, Calendar as CalIcon,
  Flag, ChevronRight, AlertCircle, Tag as TagIcon,
  LayoutGrid, List, GitBranch, Send, CalendarDays,
  CheckCircle2, Circle, Clock, User, Search, Keyboard,
  ArrowDownUp, ChevronDown, Inbox, CheckSquare, Square,
  Sparkles, Layers, Download, SlidersHorizontal, GripVertical, Upload,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

const PRIORITY_OPTIONS  = ["baja", "media", "alta", "urgente"] as const

// Status is now dynamic — driven by the active TaskStatusSet from the API.
// We keep these as a fallback when the migration hasn't been applied yet.
const FALLBACK_STATUSES = ["pendiente", "en_progreso", "completada", "cancelada"] as const

type Status   = string
type Priority = typeof PRIORITY_OPTIONS[number]

interface StatusDef {
  key:      string
  label:    string
  color:    string
  terminal: boolean
}

interface StatusSet {
  id:          string
  name:        string
  description: string | null
  is_default:  boolean
  statuses:    StatusDef[]
}
type ViewMode = "board" | "list" | "calendar"
type GroupBy  = "status" | "assignee" | "priority" | "tag" | "department" | "none"
type SortBy   = "due_at" | "priority" | "created_at" | "title"

interface Task {
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

interface TaskComment {
  id:         string
  task_id:    string
  author:     string | null
  content:    string
  kind:       "comment" | "system"
  created_at: string
}

interface PersonaLite { id: string; name: string }

interface SavedView {
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

const SAVED_VIEWS_KEY = "tasksSavedViews_v1"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}
function fmtRelative(iso: string) {
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
function toLocalInputValue(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}
// Default terminal-status keys for fallback (when activeSet is the local default).
// The actual terminal logic uses the active set's `terminal: true` flag.
const FALLBACK_TERMINAL = new Set(["completada", "cancelada"])
function isTerminal(status: string, terminalKeys: Set<string> = FALLBACK_TERMINAL) {
  return terminalKeys.has(status)
}
function isOverdue(t: Task, terminalKeys: Set<string> = FALLBACK_TERMINAL) {
  if (!t.due_at) return false
  if (isTerminal(t.status, terminalKeys)) return false
  return new Date(t.due_at).getTime() < Date.now()
}
function isDueThisWeek(t: Task, terminalKeys: Set<string> = FALLBACK_TERMINAL) {
  if (!t.due_at) return false
  if (isTerminal(t.status, terminalKeys)) return false
  const d = new Date(t.due_at).getTime()
  const now = Date.now()
  const in7 = now + 7 * 24 * 3600_000
  return d >= now && d <= in7
}
function initials(s: string) {
  return s.split(/[\s@]/).map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
}

// Default fallback set used until the API responds (avoids flash of empty board)
const DEFAULT_STATUS_SET: StatusSet = {
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

const PRIORITY_STYLE: Record<Priority, { flag: string; pill: string; weight: number }> = {
  baja:    { flag: "text-zinc-500",   pill: "text-zinc-700  border-zinc-300  bg-zinc-50",   weight: 1 },
  media:   { flag: "text-amber-600",  pill: "text-amber-800 border-amber-300 bg-amber-50",  weight: 2 },
  alta:    { flag: "text-orange-600", pill: "text-orange-800 border-orange-300 bg-orange-50", weight: 3 },
  urgente: { flag: "text-[#E42D2C]",  pill: "text-[#E42D2C] border-red-300   bg-red-50",   weight: 4 },
}

// Inline style helper — turns a hex color into pill bg/text/border styles.
function statusInlineStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: color + "10",
    borderColor:     color + "40",
    color:           color,
  }
}

// ─── Reusable input class ─────────────────────────────────────────────────────
const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a]/40 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/10 transition-all"

// ─── Avatar Stack ─────────────────────────────────────────────────────────────

function AvatarStack({ users, size = "sm" }: { users: string[]; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-7 w-7 text-[11px]" : "h-5 w-5 text-[9px]"
  if (!users.length) return null
  const visible = users.slice(0, 3)
  const extra = users.length - visible.length
  return (
    <div className="flex -space-x-1.5">
      {visible.map((u, i) => (
        <div key={i} title={u}
          className={`${dim} flex items-center justify-center rounded-full ring-2 ring-white bg-gradient-to-br from-[#E42D2C] to-[#1e3a8a] font-bold text-white`}>
          {initials(u)}
        </div>
      ))}
      {extra > 0 && (
        <div className={`${dim} flex items-center justify-center rounded-full ring-2 ring-white bg-slate-100 text-slate-700 font-bold`}>
          +{extra}
        </div>
      )}
    </div>
  )
}

// ─── Tags inline editor ───────────────────────────────────────────────────────

function TagsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const v = draft.trim()
    if (!v || value.includes(v)) { setDraft(""); return }
    onChange([...value, v]); setDraft("")
  }
  const remove = (t: string) => onChange(value.filter(x => x !== t))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[24px]">
        {value.map(t => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
            <TagIcon className="h-2.5 w-2.5 text-slate-400" />
            {t}
            <button onClick={() => remove(t)} className="text-slate-400 hover:text-red-600 transition-colors ml-0.5">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }}
        onBlur={add}
        placeholder="Agregar tag y Enter"
        className="h-7 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a]/40 focus:outline-none"
      />
    </div>
  )
}

// ─── Assignees inline editor ──────────────────────────────────────────────────

function AssigneesEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const v = draft.trim()
    if (!v || value.includes(v)) { setDraft(""); return }
    onChange([...value, v]); setDraft("")
  }
  const remove = (a: string) => onChange(value.filter(x => x !== a))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[24px]">
        {value.map(a => (
          <span key={a} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 pl-1 pr-2 py-0.5 text-[11px] text-slate-700">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#E42D2C] to-[#1e3a8a] text-[8px] font-bold text-white">
              {initials(a)}
            </span>
            {a}
            <button onClick={() => remove(a)} className="text-slate-400 hover:text-red-600 transition-colors">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }}
        onBlur={add}
        placeholder="email o nombre + Enter"
        className="h-7 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a]/40 focus:outline-none"
      />
    </div>
  )
}

// ─── Comments Section ─────────────────────────────────────────────────────────

function CommentsSection({ taskId }: { taskId: string }) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [draft,    setDraft]    = useState("")
  const [posting,  setPosting]  = useState(false)

  const getSession = async () => {
    const { data: { session } } = await createClient().auth.getSession()
    return session
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch(`/api/admin/task-comments?task_id=${taskId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) setComments((await res.json()).comments ?? [])
    } finally { setLoading(false) }
  }, [taskId])

  useEffect(() => { load() }, [load])

  const post = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    setPosting(true)
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch("/api/admin/task-comments", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ task_id: taskId, content: draft }),
      })
      if (res.ok) {
        const j = await res.json()
        if (j.comment) setComments(prev => [...prev, j.comment])
        setDraft("")
      }
    } finally { setPosting(false) }
  }

  const del = async (id: string) => {
    setComments(prev => prev.filter(c => c.id !== id))
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/task-comments", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id }),
    })
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
      ) : comments.length === 0 ? (
        <p className="text-[12px] text-slate-400 text-center py-3">Sin actividad todavía.</p>
      ) : (
        <div className="space-y-2">
          {comments.map(c => (
            <div key={c.id} className={`flex items-start gap-2 rounded-xl px-3 py-2 ${c.kind === "system" ? "" : "border border-slate-200 bg-slate-50"}`}>
              {c.kind === "system" ? (
                <span className="h-1 w-1 mt-2 rounded-full bg-slate-300 shrink-0" />
              ) : (
                <span className="flex h-6 w-6 mt-0.5 items-center justify-center rounded-full bg-gradient-to-br from-[#E42D2C] to-[#1e3a8a] text-[9px] font-bold text-white shrink-0">
                  {initials(c.author ?? "?")}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-400">
                    {c.kind === "system" ? "" : <span className="font-semibold text-slate-500">{c.author}</span>}
                    {c.kind === "system" ? "" : " · "}
                    {fmtRelative(c.created_at)}
                  </p>
                  {c.kind === "comment" && (
                    <button onClick={() => del(c.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className={`text-[13px] ${c.kind === "system" ? "text-slate-500 italic" : "text-slate-800"}`}>
                  {c.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={post} className="flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Escribir comentario..."
          className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#1e3a8a]/40"
        />
        <button
          type="submit"
          disabled={!draft.trim() || posting}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-[#E42D2C] px-3 text-[12px] font-bold text-white hover:bg-[#c42423] disabled:opacity-40 transition-all"
        >
          {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </form>
    </div>
  )
}

// ─── Sortable Subtask (used inside DetailDrawer) ─────────────────────────────

function SortableSubtaskRow({
  subtask, onToggle, onDelete,
}: {
  subtask:  Task
  onToggle: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subtask.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors"
        aria-label="Arrastrar"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onToggle}
        className={`shrink-0 h-3 w-3 rounded-full border-2 transition-all ${
          subtask.status === "completada"
            ? "bg-emerald-500 border-emerald-500"
            : "border-slate-300 hover:border-slate-500"
        }`}
      />
      <span className={`flex-1 text-[12px] ${
        subtask.status === "completada" ? "text-slate-400 line-through" : "text-slate-800"
      }`}>
        {subtask.title}
      </span>
      <button
        onClick={onDelete}
        className="text-slate-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  task, allTasks, personas, departments, onClose, onPatch, onDelete, deleting, onCreateSubtask, statuses,
}: {
  task:            Task
  allTasks:        Task[]
  personas:        PersonaLite[]
  departments:     Department[]
  onClose:         () => void
  onPatch:         (id: string, updates: Partial<Task>) => void
  onDelete:        (id: string) => void
  deleting:        boolean
  onCreateSubtask: (parentId: string, title: string) => Promise<void>
  statuses:        StatusDef[]
}) {
  const subtasks = allTasks
    .filter(t => t.parent_id === task.id)
    .sort((a, b) => {
      const av = (a as any).sort_order ?? Infinity
      const bv = (b as any).sort_order ?? Infinity
      if (av !== bv) return av - bv
      return a.created_at.localeCompare(b.created_at)
    })

  // Drag&drop sensor
  const subtaskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleSubtaskDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = subtasks.map(s => s.id)
    const oldIdx = ids.indexOf(String(active.id))
    const newIdx = ids.indexOf(String(over.id))
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(subtasks, oldIdx, newIdx)
    // Reassign sort_order with steps of 100 (room for in-between inserts)
    reordered.forEach((s, i) => {
      const newOrder = (i + 1) * 100
      if ((s as any).sort_order !== newOrder) {
        onPatch(s.id, { sort_order: newOrder } as any)
      }
    })
  }
  const [newSub, setNewSub] = useState("")
  const [savingSub, setSavingSub] = useState(false)
  const [tab, setTab] = useState<"detail" | "comments">("detail")

  const submitSub = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSub.trim()) return
    setSavingSub(true)
    await onCreateSubtask(task.id, newSub.trim())
    setNewSub("")
    setSavingSub(false)
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-[110] flex w-full max-w-[560px] flex-col border-l border-slate-200 shadow-2xl bg-white">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              defaultValue={task.title}
              onBlur={e => { const v = e.target.value.trim(); if (v && v !== task.title) onPatch(task.id, { title: v }) }}
              className="w-full bg-transparent text-lg font-bold text-slate-900 outline-none"
            />
            <p className="text-[12px] text-slate-400 mt-0.5">
              Creada {fmtDateTime(task.created_at)}{task.created_by ? ` · ${task.created_by}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onDelete(task.id)} disabled={deleting}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-40"
              title="Borrar (⌫)"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
              title="Cerrar (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {[
            { k: "detail" as const,   l: "Detalle" },
            { k: "comments" as const, l: "Actividad" },
          ].map(t => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`px-4 py-3 text-[12px] font-bold uppercase tracking-widest transition-colors border-b-2 ${
                tab === t.k
                  ? "border-[#E42D2C] text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}>
              {t.l}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {tab === "detail" && (
            <>
              {/* Status + priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Estado</p>
                  <select
                    value={task.status}
                    onChange={e => onPatch(task.id, { status: e.target.value as Status })}
                    className={inputCls}
                  >
                    {statuses.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Prioridad</p>
                  <select
                    value={task.priority}
                    onChange={e => onPatch(task.id, { priority: e.target.value as Priority })}
                    className={inputCls + " capitalize"}
                  >
                    {PRIORITY_OPTIONS.map(p => (
                      <option key={p} value={p} className="capitalize">{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Vence</p>
                <input
                  type="datetime-local"
                  defaultValue={toLocalInputValue(task.due_at)}
                  onBlur={e => onPatch(task.id, { due_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Asignados</p>
                <AssigneesEditor value={task.assignees ?? []} onChange={v => onPatch(task.id, { assignees: v })} />
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Tags</p>
                <TagsEditor value={task.tags ?? []} onChange={v => onPatch(task.id, { tags: v })} />
              </div>

              {departments.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Departamento</p>
                  <select
                    value={task.department_id ?? ""}
                    onChange={e => onPatch(task.id, { department_id: e.target.value || null })}
                    className={inputCls}
                  >
                    <option value="">— Sin departamento —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Vinculada a persona agendada</p>
                <select
                  value={task.persona_id ?? ""}
                  onChange={e => onPatch(task.id, { persona_id: e.target.value || null })}
                  className={inputCls}
                >
                  <option value="">— Ninguna —</option>
                  {personas.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Descripción</p>
                <textarea
                  defaultValue={task.description ?? ""}
                  placeholder="Detalle de la tarea..."
                  rows={5}
                  onBlur={e => onPatch(task.id, { description: e.target.value || null })}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Recurrencia (solo para tareas top-level) */}
              {!task.parent_id && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">
                      Tarea recurrente
                    </p>
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(task as any).is_recurrence_template ?? false}
                        onChange={e => onPatch(task.id, {
                          is_recurrence_template: e.target.checked,
                          recurrence_rule: e.target.checked ? ((task as any).recurrence_rule ?? "weekly") : null,
                        } as any)}
                        className="h-3 w-3 accent-[#E42D2C]"
                      />
                      Activar
                    </label>
                  </div>
                  {(task as any).is_recurrence_template && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={(task as any).recurrence_rule ?? "weekly"}
                          onChange={e => onPatch(task.id, { recurrence_rule: e.target.value } as any)}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-900 outline-none cursor-pointer hover:border-slate-300"
                        >
                          <option value="daily">Diaria</option>
                          <option value="weekly">Semanal</option>
                          <option value="monthly">Mensual</option>
                        </select>
                        <input
                          type="date"
                          value={(task as any).recurrence_until ?? ""}
                          onChange={e => onPatch(task.id, { recurrence_until: e.target.value || null } as any)}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-900 outline-none focus:border-[#1e3a8a]/40"
                          placeholder="Hasta cuándo"
                          title="Fecha límite (opcional)"
                        />
                      </div>
                      <p className="text-[10.5px] text-slate-500 leading-snug">
                        Esta tarea actúa como plantilla. Cada{" "}
                        {(task as any).recurrence_rule === "daily"   ? "día"  :
                         (task as any).recurrence_rule === "monthly" ? "mes"  : "semana"}
                        {" "}se crea automáticamente una instancia nueva con due date a las 18:00.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Subtasks */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">Subtareas</p>
                  <span className="text-[11px] text-slate-400">({subtasks.length})</span>
                </div>

                {subtasks.length > 0 && (
                  <DndContext
                    sensors={subtaskSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleSubtaskDragEnd}
                  >
                    <SortableContext
                      items={subtasks.map(s => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1">
                        {subtasks.map(s => (
                          <SortableSubtaskRow
                            key={s.id}
                            subtask={s}
                            onToggle={() => onPatch(s.id, { status: s.status === "completada" ? "pendiente" : "completada" })}
                            onDelete={() => onDelete(s.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}

                <form onSubmit={submitSub} className="flex gap-2">
                  <input
                    value={newSub}
                    onChange={e => setNewSub(e.target.value)}
                    placeholder="Sumar subtarea..."
                    className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#1e3a8a]/40"
                  />
                  <button
                    type="submit"
                    disabled={!newSub.trim() || savingSub}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30 transition-all"
                  >
                    {savingSub ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  </button>
                </form>
              </div>
            </>
          )}

          {tab === "comments" && <CommentsSection taskId={task.id} />}
        </div>
      </div>
    </Portal>
  )
}

// ─── New Task Modal ───────────────────────────────────────────────────────────

function NewTaskModal({
  personas, departments, onClose, onCreate, creating, prefillDueAt,
}: {
  personas:      PersonaLite[]
  departments:   Department[]
  onClose:       () => void
  onCreate:      (data: Partial<Task>) => Promise<void>
  creating:      boolean
  prefillDueAt?: string | null
}) {
  const [title,        setTitle]        = useState("")
  const [description,  setDescription]  = useState("")
  const [priority,     setPriority]     = useState<Priority>("media")
  const [assignees,    setAssignees]    = useState<string[]>([])
  const [tags,         setTags]         = useState<string[]>([])
  const [dueAt,        setDueAt]        = useState(prefillDueAt ? toLocalInputValue(prefillDueAt) : "")
  const [personaId,    setPersonaId]    = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [suggesting,   setSuggesting]   = useState(false)

  const handleSuggest = async () => {
    if (!title.trim()) return
    setSuggesting(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) return
      const res = await fetch("/api/admin/tasks/suggest", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ title, description }),
      })
      const j = await res.json()
      if (res.ok) {
        if (j.priority) setPriority(j.priority)
        if (Array.isArray(j.tags) && j.tags.length) {
          // Merge — don't replace user-entered tags
          setTags(prev => Array.from(new Set([...prev, ...j.tags])))
        }
        if (j.due_at && !dueAt) {
          setDueAt(toLocalInputValue(j.due_at))
        }
      }
    } finally { setSuggesting(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await onCreate({
      title:         title.trim(),
      description:   description.trim() || null,
      priority,
      assignees,
      tags,
      due_at:        dueAt ? new Date(dueAt).toISOString() : null,
      persona_id:    personaId || null,
      department_id: departmentId || null,
    })
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-3.5 max-h-[90vh] overflow-y-auto bg-white"
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-slate-900">Nueva tarea</h3>
            <button type="button" onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Título *</p>
              <button
                type="button"
                onClick={handleSuggest}
                disabled={!title.trim() || suggesting}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1e3a8a] hover:text-[#E42D2C] transition-colors disabled:opacity-40"
                title="Sugerir prioridad / tags / fecha con IA"
              >
                {suggesting
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Pensando…</>
                  : <><Sparkles className="h-3 w-3" /> Auto-completar con IA</>}
              </button>
            </div>
            <input autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="¿Qué hay que hacer?" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Descripción</p>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalle..." rows={3} className={`${inputCls} resize-none`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Prioridad</p>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className={inputCls + " capitalize"}>
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Vence</p>
              <input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Asignados</p>
            <AssigneesEditor value={assignees} onChange={setAssignees} />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Tags</p>
            <TagsEditor value={tags} onChange={setTags} />
          </div>

          {departments.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Departamento</p>
              <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className={inputCls}>
                <option value="">— Sin departamento —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          {personas.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Vincular a persona agendada</p>
              <select value={personaId} onChange={e => setPersonaId(e.target.value)} className={inputCls}>
                <option value="">— Ninguna —</option>
                {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={!title.trim() || creating}
            className="w-full h-10 rounded-xl bg-[#E42D2C] text-white text-[13px] font-bold hover:bg-[#c42423] hover:shadow-[0_8px_24px_rgba(228,45,44,0.25)] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Crear tarea
          </button>
        </form>
      </div>
    </Portal>
  )
}

// ─── Board Column (droppable wrapper) ────────────────────────────────────────

function BoardColumn({
  status, label, color, count, isOver, children,
}: {
  status:   Status
  label:    string
  color:    string         // hex color for the column accent
  count:    number
  isOver?:  boolean
  children: React.ReactNode
}) {
  const { setNodeRef } = useDroppable({ id: `col-${status}` })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border bg-slate-50/50 min-h-[200px] transition-all ${
        isOver ? "border-[#1e3a8a]/40 bg-[#1e3a8a]/[0.04] shadow-[0_0_0_3px_rgba(30,58,138,0.10)]" : "border-slate-200"
      }`}
    >
      <div
        className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 rounded-t-2xl"
        style={{ backgroundColor: color + "10" }}
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-[12px] font-bold uppercase tracking-widest text-slate-700">{label}</h3>
        </div>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-600">
          {count}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-1.5">
        {children}
      </div>
    </div>
  )
}

// ─── Quick Add Row (board column inline create) ──────────────────────────────

function QuickAddRow({
  status, onCreate,
}: {
  status:   Status
  onCreate: (title: string, status: Status) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const submit = async () => {
    const v = title.trim()
    if (!v) { setOpen(false); return }
    setBusy(true)
    await onCreate(v, status)
    setBusy(false)
    setTitle("")
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-slate-400 hover:bg-white hover:text-[#1e3a8a] transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="font-medium">Agregar tarea</span>
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-[#1e3a8a]/30 bg-white p-2 shadow-sm">
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); submit() }
          if (e.key === "Escape") { setTitle(""); setOpen(false) }
        }}
        onBlur={() => { if (!busy && !title.trim()) setOpen(false); else if (!busy) submit() }}
        placeholder="Título..."
        className="w-full text-[13px] text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
        disabled={busy}
      />
    </div>
  )
}

// ─── Task Card (kanban) ───────────────────────────────────────────────────────

function TaskCard({
  task, persona, department, subtaskCount, completedSubs, onClick, onToggleStatus,
  selected, onToggleSelect, selectionMode, draggable = false, ghost = false,
  isTerminal = false,
}: {
  task: Task
  persona: PersonaLite | null
  department: Department | null
  subtaskCount: number
  completedSubs: number
  onClick: () => void
  onToggleStatus: () => void   // parent computes next status using active set
  selected: boolean
  onToggleSelect: (e: React.MouseEvent) => void
  selectionMode: boolean
  draggable?: boolean
  ghost?: boolean
  isTerminal?: boolean
}) {
  const overdue = isOverdue(task)
  const due = fmtDateTime(task.due_at)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !draggable,
  })

  const dragStyle = transform && draggable
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      style={dragStyle}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      onClick={onClick}
      className={`group rounded-xl border bg-white transition-all p-3 space-y-2 ${
        ghost
          ? "opacity-50 border-slate-200"
          : isDragging
            ? "opacity-30 border-slate-200"
            : selected
              ? "cursor-pointer border-[#1e3a8a]/40 shadow-[0_0_0_3px_rgba(30,58,138,0.10)]"
              : "cursor-pointer border-slate-200 hover:border-[#1e3a8a]/20 hover:shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
      } ${draggable && !ghost ? "active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-start gap-2">
        {/* Checkbox visible on hover OR if selectionMode active */}
        <button
          onClick={onToggleSelect}
          className={`shrink-0 mt-0.5 transition-opacity ${
            selectionMode || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          aria-label="Seleccionar"
        >
          {selected
            ? <CheckSquare className="h-3.5 w-3.5 text-[#1e3a8a]" />
            : <Square      className="h-3.5 w-3.5 text-slate-400 hover:text-[#1e3a8a]" />}
        </button>

        <button
          onClick={e => { e.stopPropagation(); onToggleStatus() }}
          className={`shrink-0 mt-1 h-3 w-3 rounded-full border-2 transition-all ${
            isTerminal
              ? "bg-emerald-500 border-emerald-500"
              : "border-slate-300 hover:border-slate-500"
          }`}
        />
        <p className={`flex-1 text-[13px] font-medium leading-snug ${
          isTerminal ? "text-slate-400 line-through" : "text-slate-900"
        }`}>
          {task.title}
        </p>
        <Flag className={`shrink-0 h-3 w-3 ${PRIORITY_STYLE[task.priority].flag}`} />
      </div>

      {/* Department badge + Tags */}
      {(department || task.tags.length > 0) && (
        <div className="flex flex-wrap gap-1 pl-9">
          {department && (
            <span
              className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ borderColor: department.color + "40", backgroundColor: department.color + "15", color: department.color }}
            >
              {department.name}
            </span>
          )}
          {task.tags.slice(0, 4).map(t => (
            <span key={t} className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">{t}</span>
          ))}
          {task.tags.length > 4 && <span className="text-[10px] text-slate-400">+{task.tags.length - 4}</span>}
        </div>
      )}

      {/* Metadata row */}
      <div className="flex items-center justify-between gap-2 pl-9">
        <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
          {subtaskCount > 0 && (
            <span className="flex items-center gap-1" title="Subtareas">
              <GitBranch className="h-3 w-3" />
              {completedSubs}/{subtaskCount}
            </span>
          )}
          {due && (
            <span className={`flex items-center gap-1 ${overdue ? "text-[#E42D2C] font-semibold" : ""}`}>
              {overdue ? <AlertCircle className="h-3 w-3" /> : <CalIcon className="h-3 w-3" />}
              {due}
            </span>
          )}
        </div>
        <AvatarStack users={task.assignees} />
      </div>

      {persona && (
        <div className="pl-9">
          <span className="inline-block rounded-md bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
            ↳ {persona.name}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Multi-select bottom bar ─────────────────────────────────────────────────

function BulkBar({
  count, onClear, onSetStatus, onDelete, onSetPriority, statuses,
}: {
  count:         number
  onClear:       () => void
  onSetStatus:   (s: Status) => void
  onSetPriority: (p: Priority) => void
  onDelete:      () => void
  statuses:      StatusDef[]
}) {
  return (
    <Portal>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-[0_20px_40px_rgba(15,23,42,0.15)]">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a8a] text-[12px] font-bold text-white">
              {count}
            </span>
            <span className="text-[12px] font-medium text-slate-700">seleccionadas</span>
          </div>

          {/* Status selector */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-700 hover:border-[#1e3a8a]/30 transition-colors">
              <Circle className="h-3 w-3" /> Estado <ChevronDown className="h-3 w-3" />
            </button>
            <div className="absolute bottom-full mb-1 left-0 hidden group-hover:block min-w-[180px] rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
              {statuses.map(s => (
                <button
                  key={s.key}
                  onClick={() => onSetStatus(s.key)}
                  className="flex w-full items-center gap-2 text-left px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority selector */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-700 hover:border-[#1e3a8a]/30 transition-colors">
              <Flag className="h-3 w-3" /> Prioridad <ChevronDown className="h-3 w-3" />
            </button>
            <div className="absolute bottom-full mb-1 left-0 hidden group-hover:block min-w-[120px] rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p}
                  onClick={() => onSetPriority(p)}
                  className="block w-full text-left px-3 py-2 text-[12px] capitalize hover:bg-slate-50 flex items-center gap-2"
                >
                  <Flag className={`h-3 w-3 ${PRIORITY_STYLE[p].flag}`} /> {p}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 h-8 rounded-lg border border-red-200 bg-red-50 px-2.5 text-[12px] font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            <Trash2 className="h-3 w-3" /> Borrar
          </button>

          <div className="border-l border-slate-200 pl-2">
            <button
              onClick={onClear}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Cancelar (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

// ─── Keyboard shortcuts help modal ───────────────────────────────────────────

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts: { keys: string[]; label: string }[] = [
    { keys: ["Q"],         label: "Nueva tarea" },
    { keys: ["I"],         label: "Crear tareas desde texto con IA" },
    { keys: ["T"],         label: "Aplicar template" },
    { keys: ["J"],         label: "Siguiente tarea" },
    { keys: ["K"],         label: "Tarea anterior" },
    { keys: ["Enter"],     label: "Abrir detalle" },
    { keys: ["E"],         label: "Editar (abrir detalle)" },
    { keys: ["X"],         label: "Marcar completada" },
    { keys: ["⌫"],         label: "Borrar tarea seleccionada" },
    { keys: ["1"],         label: "Vista Board" },
    { keys: ["2"],         label: "Vista Lista" },
    { keys: ["3"],         label: "Vista Calendario" },
    { keys: ["/"],         label: "Buscar" },
    { keys: ["Esc"],       label: "Cerrar" },
    { keys: ["?"],         label: "Mostrar atajos" },
  ]

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-[#1e3a8a]" />
              <h3 className="text-base font-bold text-slate-900">Atajos de teclado</h3>
            </div>
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            {shortcuts.map(s => (
              <div key={s.label} className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-[13px] text-slate-700">{s.label}</span>
                <div className="flex items-center gap-1">
                  {s.keys.map(k => (
                    <kbd key={k} className="inline-flex items-center justify-center min-w-[24px] h-6 rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-bold text-slate-700">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Portal>
  )
}

// ─── Filter Chip ──────────────────────────────────────────────────────────────

function FilterChip({
  active, onClick, icon: Icon, label, count, accent,
}: {
  active:  boolean
  onClick: () => void
  icon?:   any
  label:   string
  count?:  number
  accent?: "navy" | "red" | "amber" | "emerald"
}) {
  const accentStyle = active ? {
    navy:    "border-[#1e3a8a]/30 bg-[#1e3a8a]/[0.06] text-[#1e3a8a]",
    red:     "border-red-300 bg-red-50 text-[#E42D2C]",
    amber:   "border-amber-300 bg-amber-50 text-amber-800",
    emerald: "border-emerald-300 bg-emerald-50 text-emerald-700",
  }[accent ?? "navy"] : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-8 rounded-full border px-3 text-[12px] font-medium transition-colors ${accentStyle}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
      {count !== undefined && count > 0 && (
        <span className={`tabular-nums rounded-full px-1.5 text-[10px] font-bold ${
          active ? "bg-white/60" : "bg-slate-100"
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function TasksView() {
  const [tasks,         setTasks]         = useState<Task[]>([])
  const [personas,      setPersonas]      = useState<PersonaLite[]>([])
  const [loading,       setLoading]       = useState(true)
  const [selected,      setSelected]      = useState<Task | null>(null)
  const [deletingId,    setDeletingId]    = useState<string | null>(null)
  const [search,        setSearch]        = useState("")
  const [filterAssignee,setFilterAssignee]= useState<string>("todos")
  const [filterTag,     setFilterTag]     = useState<string>("todos")
  const [filterPriority,setFilterPriority]= useState<Priority | "todos">("todos")
  const [filterDepartment,setFilterDepartment]= useState<string>("todos")
  const [departments,  setDepartments]  = useState<Department[]>([])
  const [showNewForm,   setShowNewForm]   = useState(false)
  const [newPrefillDate,setNewPrefillDate]= useState<string | null>(null)
  const [creating,      setCreating]      = useState(false)
  const [view,          setView]          = useState<ViewMode>("board")
  const [groupBy,       setGroupBy]       = useState<GroupBy>("status")
  const [sortBy,        setSortBy]        = useState<SortBy>("due_at")
  const [quickFilter,   setQuickFilter]   = useState<"all" | "mine" | "overdue" | "this_week" | "unassigned">("all")
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showAiExtract, setShowAiExtract] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showImport,    setShowImport]    = useState(false)
  const [currentEmail,  setCurrentEmail]  = useState<string>("")
  const [draggingId,    setDraggingId]    = useState<string | null>(null)
  const [overColumn,    setOverColumn]    = useState<Status | null>(null)
  const [statusSets,    setStatusSets]    = useState<StatusSet[]>([DEFAULT_STATUS_SET])
  const [activeSetId,   setActiveSetId]   = useState<string>("_default_local")
  const [filtersOpen,   setFiltersOpen]   = useState(false)   // mobile filters drawer
  const [savedViews,    setSavedViews]    = useState<SavedView[]>([])

  // dnd-kit sensor with a small drag-activation distance so clicks still work
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Quick-action: open "Nueva tarea" modal when ?new=1 is present
  useEffect(() => {
    if (searchParams?.get("new") === "1") {
      setShowNewForm(true)
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, router, pathname])

  // Pre-filter por departamento cuando viene ?department=<id> desde otra vista
  // (ej: cards de "Departamentos" en /inicio). Limpia el param después de aplicar
  // para que el resto de la navegación no quede pegada al filtro.
  useEffect(() => {
    const deptId = searchParams?.get("department")
    if (deptId) {
      setFilterDepartment(deptId)
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, router, pathname])

  const getSession = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      setCurrentEmail(session.user?.email ?? "")
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const [tRes, pRes, sRes, dRes] = await Promise.all([
        fetch("/api/admin/tasks?include_subtasks=true", { headers }),
        fetch("/api/admin/personas",                     { headers }),
        fetch("/api/admin/task-status-sets",             { headers }),
        fetch("/api/departments",                        { headers }),
      ])
      if (tRes.ok) setTasks((await tRes.json()).tasks ?? [])
      if (dRes.ok) setDepartments((await dRes.json()).departments ?? [])
      if (pRes.ok) {
        const j = await pRes.json()
        setPersonas((j.personas ?? []).map((p: any) => ({ id: p.id, name: p.name })))
      }
      if (sRes.ok) {
        const j = await sRes.json()
        const sets = (j.sets ?? []) as StatusSet[]
        if (sets.length) {
          setStatusSets(sets)
          // Resolve active set: localStorage > default > first
          const stored = typeof window !== "undefined" ? window.localStorage.getItem("tasksActiveSetId") : null
          const found  = stored && sets.find(s => s.id === stored)
          const def    = sets.find(s => s.is_default) ?? sets[0]
          setActiveSetId((found ? found.id : def?.id) ?? "_default_local")
        }
      }
    } finally { setLoading(false) }
  }, [])

  // Derived active set + columns
  const activeSet  = useMemo(() => {
    return statusSets.find(s => s.id === activeSetId) ?? statusSets[0] ?? DEFAULT_STATUS_SET
  }, [statusSets, activeSetId])

  // Set of "terminal" status keys (completed/cancelled/lost/awarded etc) — used to
  // exclude finished tasks from overdue + due-this-week filters.
  const terminalKeys = useMemo(() => {
    const k = new Set(activeSet.statuses.filter(s => s.terminal).map(s => s.key))
    // Always include the legacy hardcoded terminals so a mix of old + new tasks behaves correctly
    k.add("completada"); k.add("cancelada")
    return k
  }, [activeSet])

  const handleSetChange = (id: string) => {
    setActiveSetId(id)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("tasksActiveSetId", id)
    }
  }

  // Load + save saved views (localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(SAVED_VIEWS_KEY)
      if (raw) setSavedViews(JSON.parse(raw))
    } catch { /* corrupt — ignore */ }
  }, [])

  const persistViews = (views: SavedView[]) => {
    setSavedViews(views)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views))
    }
  }

  const handleSaveCurrentView = () => {
    const name = window.prompt("Nombre de esta vista:")
    if (!name?.trim()) return
    const v: SavedView = {
      id: `sv-${Date.now()}`,
      name: name.trim(),
      search,
      filterPriority,
      filterAssignee,
      filterTag,
      filterDepartment,
      quickFilter,
      sortBy,
      view,
    }
    persistViews([...savedViews, v])
  }

  const applyView = (v: SavedView) => {
    setSearch(v.search)
    setFilterPriority(v.filterPriority as any)
    setFilterAssignee(v.filterAssignee)
    setFilterTag(v.filterTag)
    setFilterDepartment(v.filterDepartment ?? "todos")
    setQuickFilter(v.quickFilter as any)
    setSortBy(v.sortBy as any)
    setView(v.view)
  }

  const deleteView = (id: string) => {
    persistViews(savedViews.filter(v => v.id !== id))
  }

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleCreate = async (data: Partial<Task>) => {
    setCreating(true)
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch("/api/admin/tasks", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify(data),
      })
      const json = await res.json()
      if (res.ok && json.task) {
        setTasks(prev => [json.task, ...prev])
        setShowNewForm(false)
        setNewPrefillDate(null)
      }
    } finally { setCreating(false) }
  }

  const quickCreate = async (title: string, status: Status) => {
    const session = await getSession()
    if (!session) return
    const res = await fetch("/api/admin/tasks", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ title, status }),
    })
    const json = await res.json()
    if (res.ok && json.task) setTasks(prev => [json.task, ...prev])
  }

  const createSubtask = async (parentId: string, title: string) => {
    const session = await getSession()
    if (!session) return
    const res = await fetch("/api/admin/tasks", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ title, parent_id: parentId }),
    })
    const json = await res.json()
    if (res.ok && json.task) setTasks(prev => [json.task, ...prev])
  }

  const patch = useCallback(async (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    setSelected(prev => prev && prev.id === id ? { ...prev, ...updates } : prev)
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/tasks", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id, ...updates }),
    })
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id)
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/tasks", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id }),
    })
    setTasks(prev => prev.filter(t => t.id !== id && t.parent_id !== id))
    setSelected(prev => prev?.id === id ? null : prev)
    setDeletingId(null)
  }, [])

  // Bulk actions
  const bulkPatch = async (updates: Partial<Task>) => {
    const ids = Array.from(selectedIds)
    setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, ...updates } : t))
    const session = await getSession()
    if (!session) return
    await Promise.all(ids.map(id => fetch("/api/admin/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, ...updates }),
    })))
  }
  const bulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (!confirm(`¿Borrar ${ids.length} tarea${ids.length === 1 ? "" : "s"}?`)) return
    setTasks(prev => prev.filter(t => !ids.includes(t.id) && (t.parent_id ? !ids.includes(t.parent_id) : true)))
    setSelectedIds(new Set())
    const session = await getSession()
    if (!session) return
    await Promise.all(ids.map(id => fetch("/api/admin/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id }),
    })))
  }

  // Top-level tasks only for board / list (subtasks live inside drawer)
  const topLevel = useMemo(() => tasks.filter(t => !t.parent_id), [tasks])

  const allAssignees = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach(t => t.assignees?.forEach(a => set.add(a)))
    return Array.from(set).sort()
  }, [tasks])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach(t => t.tags?.forEach(tg => set.add(tg)))
    return Array.from(set).sort()
  }, [tasks])

  const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments])

  // Quick filter counts
  const counts = useMemo(() => ({
    all:        topLevel.length,
    mine:       topLevel.filter(t => currentEmail && t.assignees?.includes(currentEmail)).length,
    overdue:    topLevel.filter(t => isOverdue(t, terminalKeys)).length,
    this_week:  topLevel.filter(t => isDueThisWeek(t, terminalKeys)).length,
    unassigned: topLevel.filter(t => !t.assignees?.length).length,
  }), [topLevel, currentEmail, terminalKeys])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return topLevel.filter(t => {
      // Quick filter
      if (quickFilter === "mine" && (!currentEmail || !t.assignees?.includes(currentEmail))) return false
      if (quickFilter === "overdue" && !isOverdue(t, terminalKeys)) return false
      if (quickFilter === "this_week" && !isDueThisWeek(t, terminalKeys)) return false
      if (quickFilter === "unassigned" && t.assignees?.length) return false

      // Dropdown filters
      if (filterAssignee !== "todos" && !t.assignees?.includes(filterAssignee)) return false
      if (filterTag !== "todos" && !t.tags?.includes(filterTag)) return false
      if (filterPriority !== "todos" && t.priority !== filterPriority) return false
      if (filterDepartment !== "todos" && t.department_id !== filterDepartment) return false

      // Free-text search
      if (!q) return true
      return [t.title, t.description, ...(t.assignees ?? []), ...(t.tags ?? [])]
        .some(v => v?.toLowerCase().includes(q))
    })
  }, [topLevel, search, filterAssignee, filterTag, filterPriority, filterDepartment, quickFilter, currentEmail, terminalKeys])

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      switch (sortBy) {
        case "due_at": {
          const aT = a.due_at ? new Date(a.due_at).getTime() : Infinity
          const bT = b.due_at ? new Date(b.due_at).getTime() : Infinity
          return aT - bT
        }
        case "priority":
          return PRIORITY_STYLE[b.priority].weight - PRIORITY_STYLE[a.priority].weight
        case "title":
          return a.title.localeCompare(b.title)
        case "created_at":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
    return arr
  }, [filtered, sortBy])

  const personasMap = useMemo(() => {
    const m = new Map<string, PersonaLite>()
    personas.forEach(p => m.set(p.id, p))
    return m
  }, [personas])

  const subtaskStats = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>()
    tasks.forEach(t => {
      if (t.parent_id) {
        const s = map.get(t.parent_id) ?? { total: 0, done: 0 }
        s.total++
        if (t.status === "completada") s.done++
        map.set(t.parent_id, s)
      }
    })
    return map
  }, [tasks])

  const grouped = useMemo(() => {
    const g: Record<string, Task[]> = {}
    if (groupBy === "department") {
      departments.forEach(d => { g[d.id] = [] })
      g["__none"] = []
      sorted.forEach(t => {
        if (t.department_id && g[t.department_id]) g[t.department_id].push(t)
        else g["__none"].push(t)
      })
    } else {
      activeSet.statuses.forEach(s => { g[s.key] = [] })
      // "Otros" bucket: tasks whose status doesn't match any column in the active set
      g["__other"] = []
      sorted.forEach(t => {
        if (g[t.status]) g[t.status].push(t)
        else g["__other"].push(t)
      })
    }
    return g
  }, [sorted, activeSet, groupBy, departments])

  // Cycle a task to the "next" status using the active set.
  // Logic: if currently in a non-terminal status, move to the next non-terminal
  // (or to the first terminal if it's the last non-terminal). If currently terminal,
  // go back to the first non-terminal.
  const cycleStatus = useCallback((task: Task) => {
    const all = activeSet.statuses
    if (!all.length) return
    const nonTerminals = all.filter(s => !s.terminal)
    const terminals    = all.filter(s => s.terminal)
    const idx = all.findIndex(s => s.key === task.status)
    let next: string
    if (idx === -1) {
      next = nonTerminals[0]?.key ?? all[0].key
    } else {
      const cur = all[idx]
      if (cur.terminal) {
        next = nonTerminals[0]?.key ?? all[0].key
      } else {
        // first terminal status if available, else next non-terminal, else loop
        next = terminals[0]?.key ?? nonTerminals[(idx + 1) % nonTerminals.length]?.key ?? all[0].key
      }
    }
    if (next !== task.status) patch(task.id, { status: next })
  }, [activeSet, patch])

  // ─── Selection helpers ────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())
  const allSelected = sorted.length > 0 && sorted.every(t => selectedIds.has(t.id))
  const toggleSelectAll = () => {
    if (allSelected) clearSelection()
    else setSelectedIds(new Set(sorted.map(t => t.id)))
  }

  // Export to CSV — uses the currently filtered + sorted set
  const handleExportCSV = () => {
    const rows = sorted.map(t => ({
      titulo:       t.title,
      estado:       t.status,
      prioridad:    t.priority,
      departamento: t.department_id ? (deptMap.get(t.department_id)?.name ?? "") : "",
      asignados:    (t.assignees ?? []).join("; "),
      tags:         (t.tags ?? []).join("; "),
      vence:        csvDate(t.due_at),
      creada:       csvDate(t.created_at),
      descripcion:  t.description ?? "",
    }))
    exportToCSV(rows, `tareas_${new Date().toISOString().slice(0, 10)}.csv`, {
      columns: [
        { key: "titulo",       header: "Título"       },
        { key: "estado",       header: "Estado"       },
        { key: "prioridad",    header: "Prioridad"    },
        { key: "departamento", header: "Departamento" },
        { key: "asignados",    header: "Asignados"    },
        { key: "tags",         header: "Tags"         },
        { key: "vence",        header: "Vence"        },
        { key: "creada",       header: "Creada"       },
        { key: "descripcion",  header: "Descripción"  },
      ],
    })
  }

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    function isInsideEditable(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName.toLowerCase()
      return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable
    }

    function onKey(e: KeyboardEvent) {
      // Esc: close modal/drawer/clear selection
      if (e.key === "Escape") {
        if (showNewForm)        return setShowNewForm(false)
        if (showShortcuts)      return setShowShortcuts(false)
        if (selected)           return setSelected(null)
        if (selectedIds.size)   return clearSelection()
        return
      }

      if (isInsideEditable(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // ? show shortcuts
      if (e.key === "?") {
        e.preventDefault()
        setShowShortcuts(s => !s)
        return
      }

      // / focus search
      if (e.key === "/") {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      // Q new task (only if drawer/modal not open)
      if ((e.key === "q" || e.key === "Q") && !selected && !showNewForm) {
        e.preventDefault()
        setShowNewForm(true)
        return
      }

      // I AI Extract from text
      if ((e.key === "i" || e.key === "I") && !selected && !showAiExtract) {
        e.preventDefault()
        setShowAiExtract(true)
        return
      }

      // T Templates
      if ((e.key === "t" || e.key === "T") && !selected && !showTemplates) {
        e.preventDefault()
        setShowTemplates(true)
        return
      }

      // 1/2/3 view switch
      if (e.key === "1") return setView("board")
      if (e.key === "2") return setView("list")
      if (e.key === "3") return setView("calendar")

      // Drawer-aware shortcuts (when a task is open)
      if (selected) {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault()
          handleDelete(selected.id)
          return
        }
        if (e.key === "x" || e.key === "X") {
          e.preventDefault()
          cycleStatus(selected)
          return
        }
      }

      // J/K navigate within sorted
      if ((e.key === "j" || e.key === "J" || e.key === "k" || e.key === "K") && sorted.length) {
        e.preventDefault()
        const idx = selected ? sorted.findIndex(t => t.id === selected.id) : -1
        const dir = (e.key === "j" || e.key === "J") ? 1 : -1
        const nextIdx = idx === -1 ? 0 : Math.max(0, Math.min(sorted.length - 1, idx + dir))
        setSelected(sorted[nextIdx])
        return
      }

      // Enter / E open detail when none open
      if ((e.key === "Enter" || e.key === "e" || e.key === "E") && !selected && sorted.length) {
        e.preventDefault()
        setSelected(sorted[0])
        return
      }
    }

    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [selected, selectedIds, sorted, showNewForm, showShortcuts, showAiExtract, showTemplates, patch, handleDelete, cycleStatus])

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {showNewForm && (
        <NewTaskModal
          personas={personas}
          departments={departments}
          onClose={() => { setShowNewForm(false); setNewPrefillDate(null) }}
          onCreate={handleCreate}
          creating={creating}
          prefillDueAt={newPrefillDate}
        />
      )}

      {selected && (
        <DetailDrawer
          task={selected}
          allTasks={tasks}
          personas={personas}
          departments={departments}
          onClose={() => setSelected(null)}
          onPatch={patch}
          onDelete={handleDelete}
          deleting={deletingId === selected.id}
          onCreateSubtask={createSubtask}
          statuses={activeSet.statuses}
        />
      )}

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {showAiExtract && (
        <AiExtractModal
          onClose={() => setShowAiExtract(false)}
          onApplied={(created) => setTasks(prev => [...created, ...prev])}
        />
      )}

      {showTemplates && (
        <TemplatesModal
          onClose={() => setShowTemplates(false)}
          onApplied={(created) => { setTasks(prev => [created, ...prev]); fetchAll() }}
        />
      )}

      {showImport && (() => {
        const deptByName = new Map(departments.map(d => [d.name.toLowerCase(), d.id]))
        return (
        <CsvImportModal
          title="Importar tareas desde CSV"
          description="Cada fila se convierte en una tarea nueva. Pendiente por default."
          templateCSV={`titulo,descripcion,prioridad,departamento,asignados,tags,vence
"Mandar capability statement","Cliente XYZ necesita capability statement actualizada",alta,Marketing,"santo@govbidder.com,marcelo@govbidder.com","client,capability_statement",2026-05-15T18:00:00Z
"Research bid 2024-007",,media,IA,marcelo@govbidder.com,"bid,research",
`}
          columns={[
            { field: "title",         label: "Título",       required: true,  aliases: ["titulo","name","tarea"] },
            { field: "description",   label: "Descripción",  aliases: ["descripcion","desc","detalle"] },
            { field: "priority",      label: "Prioridad",    aliases: ["prioridad"] },
            { field: "department_id", label: "Departamento", aliases: ["departamento","department","depto","area","área"],
              transform: v => deptByName.get(v.trim().toLowerCase()) ?? null },
            { field: "assignees",     label: "Asignados",    aliases: ["asignados","asignado","assignee","emails"],
              transform: v => v.split(/[,;]/).map(s => s.trim()).filter(Boolean) },
            { field: "tags",          label: "Tags",         aliases: ["tags"],
              transform: v => v.split(/[,;]/).map(s => s.trim()).filter(Boolean) },
            { field: "due_at",        label: "Vence",        aliases: ["vence","due","deadline","due_date"] },
          ]}
          onClose={() => setShowImport(false)}
          onImport={async (rowsToInsert) => {
            const session = await getSession()
            if (!session) return { inserted: 0, failed: rowsToInsert.length, errors: ["Sesión expirada"] }
            let inserted = 0
            const errors: string[] = []
            for (const row of rowsToInsert) {
              try {
                const res = await fetch("/api/admin/tasks", {
                  method:  "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                  body:    JSON.stringify(row),
                })
                if (res.ok) inserted++
                else {
                  const j = await res.json().catch(() => ({}))
                  errors.push(`"${row.title ?? "—"}": ${j.error ?? "error"}`)
                }
              } catch (e: any) {
                errors.push(`"${row.title ?? "—"}": ${e?.message ?? "error"}`)
              }
            }
            await fetchAll()
            return { inserted, failed: rowsToInsert.length - inserted, errors }
          }}
        />
        )
      })()}

      {selectedIds.size > 0 && (
        <BulkBar
          count={selectedIds.size}
          onClear={clearSelection}
          onSetStatus={s => bulkPatch({ status: s })}
          onSetPriority={p => bulkPatch({ priority: p })}
          onDelete={bulkDelete}
          statuses={activeSet.statuses}
        />
      )}

      <div className="space-y-5">

        {/* ─── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a8a] tracking-tight">Tareas</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {topLevel.length} {topLevel.length === 1 ? "tarea" : "tareas"}
              {counts.overdue > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-[#E42D2C]">
                  · <AlertCircle className="h-3 w-3" /> {counts.overdue} vencidas
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="inline-flex h-9 rounded-xl border border-slate-200 bg-white p-0.5">
              {[
                { k: "board" as ViewMode,    Icon: LayoutGrid,   label: "Board",      shortcut: "1" },
                { k: "list" as ViewMode,     Icon: List,         label: "Lista",      shortcut: "2" },
                { k: "calendar" as ViewMode, Icon: CalendarDays, label: "Calendario", shortcut: "3" },
              ].map(v => (
                <button
                  key={v.k}
                  onClick={() => setView(v.k)}
                  className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all ${
                    view === v.k
                      ? "bg-[#1e3a8a] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title={`${v.label} (${v.shortcut})`}
                >
                  <v.Icon className="h-3.5 w-3.5" /> {v.label}
                </button>
              ))}
            </div>

            {/* Status set picker (only when more than one set is available) */}
            {statusSets.length > 1 && (
              <select
                value={activeSetId}
                onChange={e => handleSetChange(e.target.value)}
                className="hidden lg:block h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 outline-none cursor-pointer hover:border-[#1e3a8a]/30 transition-colors"
                title="Cambiar workflow de estados"
              >
                {statusSets.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.is_default ? "★ " : ""}{s.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => setShowTemplates(true)}
              className="hidden sm:flex items-center gap-1.5 h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 hover:border-[#1e3a8a]/30 hover:text-[#1e3a8a] transition-all"
              title="Aplicar template (T)"
            >
              <Layers className="h-3.5 w-3.5" />
              Templates
            </button>
            <button
              onClick={() => setShowAiExtract(true)}
              className="hidden sm:flex items-center gap-1.5 h-9 rounded-xl border border-[#1e3a8a]/25 bg-gradient-to-br from-[#E42D2C]/[0.05] to-[#1e3a8a]/[0.05] px-3 text-[12px] font-semibold text-[#1e3a8a] hover:border-[#1e3a8a]/40 hover:from-[#E42D2C]/[0.08] hover:to-[#1e3a8a]/[0.08] transition-all"
              title="Crear tareas desde texto con IA (I)"
            >
              <Sparkles className="h-3.5 w-3.5" />
              IA Extract
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-[#1e3a8a] hover:border-[#1e3a8a]/30 transition-all"
              title="Importar CSV"
            >
              <Upload className="h-4 w-4" />
            </button>
            <button
              onClick={handleExportCSV}
              className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-[#1e3a8a] hover:border-[#1e3a8a]/30 transition-all"
              title="Exportar CSV"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-[#1e3a8a] hover:border-[#1e3a8a]/30 transition-all"
              title="Atajos (?)"
            >
              <Keyboard className="h-4 w-4" />
            </button>
            <button onClick={fetchAll} disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all disabled:opacity-40"
              title="Refrescar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 h-9 rounded-xl bg-[#E42D2C] px-4 text-sm font-bold text-white hover:bg-[#c42423] hover:shadow-[0_4px_14px_rgba(228,45,44,0.25)] transition-all"
              title="Nueva tarea (Q)"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva tarea
              <kbd className="hidden sm:inline ml-1 rounded bg-white/20 px-1 text-[10px]">Q</kbd>
            </button>
          </div>
        </div>

        {/* ─── Saved Views (tabs) ──────────────────────────────────────── */}
        {savedViews.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]/70 mr-1">
              Vistas:
            </span>
            {savedViews.map(v => (
              <div key={v.id} className="group inline-flex items-stretch rounded-full border border-slate-200 bg-white overflow-hidden hover:border-[#1e3a8a]/30 transition-colors">
                <button
                  onClick={() => applyView(v)}
                  className="px-3 h-7 text-[11px] font-medium text-slate-700 hover:text-[#1e3a8a] transition-colors"
                >
                  {v.name}
                </button>
                <button
                  onClick={() => deleteView(v.id)}
                  className="px-1.5 h-7 text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors border-l border-slate-200 opacity-0 group-hover:opacity-100"
                  title="Borrar vista"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              onClick={handleSaveCurrentView}
              className="inline-flex items-center gap-1 h-7 rounded-full border border-dashed border-slate-300 bg-white px-3 text-[10.5px] font-medium text-slate-500 hover:border-[#1e3a8a]/40 hover:text-[#1e3a8a] transition-colors"
              title="Guardar combinación actual de filtros como vista"
            >
              <Plus className="h-3 w-3" />
              Guardar vista
            </button>
          </div>
        )}
        {savedViews.length === 0 && (
          <div className="flex items-center">
            <button
              onClick={handleSaveCurrentView}
              className="inline-flex items-center gap-1 h-7 rounded-full border border-dashed border-slate-300 bg-white px-3 text-[10.5px] font-medium text-slate-400 hover:border-[#1e3a8a]/40 hover:text-[#1e3a8a] transition-colors"
              title="Guardar combinación actual de filtros como vista"
            >
              <Plus className="h-3 w-3" />
              Guardar vista actual
            </button>
          </div>
        )}

        {/* ─── Quick filter chips ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={quickFilter === "all"}
            onClick={() => setQuickFilter("all")}
            icon={Inbox}
            label="Todas"
            count={counts.all}
            accent="navy"
          />
          <FilterChip
            active={quickFilter === "mine"}
            onClick={() => setQuickFilter("mine")}
            icon={User}
            label="Mías"
            count={counts.mine}
            accent="navy"
          />
          <FilterChip
            active={quickFilter === "overdue"}
            onClick={() => setQuickFilter("overdue")}
            icon={AlertCircle}
            label="Vencidas"
            count={counts.overdue}
            accent="red"
          />
          <FilterChip
            active={quickFilter === "this_week"}
            onClick={() => setQuickFilter("this_week")}
            icon={Clock}
            label="Esta semana"
            count={counts.this_week}
            accent="amber"
          />
          <FilterChip
            active={quickFilter === "unassigned"}
            onClick={() => setQuickFilter("unassigned")}
            label="Sin asignar"
            count={counts.unassigned}
            accent="navy"
          />
        </div>

        {/* ─── Toolbar: search + filters + sort ───────────────────────── */}
        <div className="border-b border-slate-200 pb-4 space-y-2.5">
          {/* Row 1: search + (mobile) filters toggle */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar tareas, tags, asignados..."
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a]/40 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/10"
              />
              <kbd className="hidden sm:inline absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-bold text-slate-400">/</kbd>
            </div>

            {/* Mobile filters toggle */}
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className={`md:hidden flex items-center gap-1.5 h-9 rounded-xl border px-3 text-[12px] font-semibold transition-colors ${
                filtersOpen
                  ? "border-[#1e3a8a]/40 bg-[#1e3a8a]/[0.06] text-[#1e3a8a]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
              aria-label="Filtros"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
            </button>
          </div>

          {/* Row 2: filters (always visible md+; toggleable on mobile) */}
          <div className={`${filtersOpen ? "flex" : "hidden md:flex"} flex-wrap items-center gap-2.5`}>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value as any)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 outline-none cursor-pointer hover:border-slate-300">
              <option value="todos">Todas las prioridades</option>
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>

            {allAssignees.length > 0 && (
              <select
                value={filterAssignee}
                onChange={e => setFilterAssignee(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 outline-none cursor-pointer hover:border-slate-300">
                <option value="todos">Todos los asignados</option>
                {allAssignees.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            {allTags.length > 0 && (
              <select
                value={filterTag}
                onChange={e => setFilterTag(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 outline-none cursor-pointer hover:border-slate-300">
                <option value="todos">Todos los tags</option>
                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {departments.length > 0 && (
              <select
                value={filterDepartment}
                onChange={e => setFilterDepartment(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 outline-none cursor-pointer hover:border-slate-300">
                <option value="todos">Todos los departamentos</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}

            <div className="ml-auto flex items-center gap-2">
              {view === "board" && (
                <select
                  value={groupBy}
                  onChange={e => setGroupBy(e.target.value as GroupBy)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 outline-none cursor-pointer hover:border-slate-300"
                  title="Agrupar por"
                >
                  <option value="status">Por estado</option>
                  <option value="department">Por departamento</option>
                  <option value="priority">Por prioridad</option>
                  <option value="assignee">Por asignado</option>
                  <option value="tag">Por tag</option>
                </select>
              )}
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
                <ArrowDownUp className="h-3 w-3" />
                <span>Ordenar:</span>
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortBy)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 outline-none cursor-pointer hover:border-slate-300">
                <option value="due_at">Vencimiento</option>
                <option value="priority">Prioridad</option>
                <option value="created_at">Creación</option>
                <option value="title">Título</option>
              </select>
            </div>
          </div>
        </div>

        {/* ─── Body ───────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200 mb-4">
              <Inbox className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-[15px] font-semibold text-slate-700">No hay tareas que coincidan</p>
            <p className="text-[13px] text-slate-400 mt-1">Probá ajustar los filtros, o creá una nueva con <kbd className="rounded border border-slate-200 bg-slate-50 px-1 text-[11px] font-bold text-slate-600">Q</kbd>.</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="mt-4 inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva tarea
            </button>
          </div>
        ) : view === "board" ? (
          <DndContext
            sensors={sensors}
            onDragStart={(e: DragStartEvent) => {
              setDraggingId(String(e.active.id))
              setOverColumn(null)
            }}
            onDragOver={(e) => {
              const overId = e.over?.id ? String(e.over.id) : null
              if (overId?.startsWith("col-")) {
                setOverColumn(overId.slice(4) as Status)
              } else {
                setOverColumn(null)
              }
            }}
            onDragEnd={(e: DragEndEvent) => {
              const taskId = String(e.active.id)
              const overId = e.over?.id ? String(e.over.id) : null
              setDraggingId(null)
              setOverColumn(null)
              if (!overId?.startsWith("col-")) return
              const colValue = overId.slice(4)
              const t = tasks.find(x => x.id === taskId)
              if (!t) return
              if (groupBy === "department") {
                const newDept = colValue === "__none" ? null : colValue
                if (t.department_id !== newDept) patch(taskId, { department_id: newDept } as any)
              } else {
                if (t.status !== colValue) patch(taskId, { status: colValue })
              }
            }}
          >
            {(() => {
              const boardColumns = groupBy === "department"
                ? [
                    ...departments.map(d => ({ key: d.id, label: d.name, color: d.color })),
                    { key: "__none", label: "Sin departamento", color: "#94a3b8" },
                  ]
                : [
                    ...activeSet.statuses.map(s => ({ key: s.key, label: s.label, color: s.color })),
                    ...(grouped["__other"]?.length ? [{ key: "__other", label: "Otros", color: "#94a3b8" }] : []),
                  ]
              const colCount = boardColumns.length
              return (
                <div
                  className={`grid gap-4 ${
                    colCount <= 3 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" :
                    colCount === 4 ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4" :
                    "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"
                  }`}
                >
                  {boardColumns.map(col => {
                    const list = grouped[col.key] ?? []
                    return (
                      <BoardColumn
                        key={col.key}
                        status={col.key}
                        label={col.label}
                        color={col.color}
                        count={list.length}
                        isOver={overColumn === col.key}
                      >
                        {list.map(t => {
                          const stat = subtaskStats.get(t.id)
                          return (
                            <TaskCard
                              key={t.id}
                              task={t}
                              persona={t.persona_id ? personasMap.get(t.persona_id) ?? null : null}
                              department={t.department_id ? deptMap.get(t.department_id) ?? null : null}
                              subtaskCount={stat?.total ?? 0}
                              completedSubs={stat?.done ?? 0}
                              onClick={() => { if (!draggingId) setSelected(t) }}
                              onToggleStatus={() => cycleStatus(t)}
                              selected={selectedIds.has(t.id)}
                              onToggleSelect={(e) => { e.stopPropagation(); toggleSelect(t.id) }}
                              selectionMode={selectedIds.size > 0}
                              draggable
                              isTerminal={terminalKeys.has(t.status)}
                            />
                          )
                        })}
                        {groupBy !== "department" && <QuickAddRow status={col.key} onCreate={quickCreate} />}
                      </BoardColumn>
                    )
                  })}
                </div>
              )
            })()}

            {/* Drag overlay — visual feedback while dragging.
                Portaled to document.body to escape the .page-enter transform
                that would otherwise create a containing block and offset the
                overlay from the cursor. */}
            <Portal>
              <DragOverlay dropAnimation={null}>
                {draggingId ? (() => {
                  const t = tasks.find(x => x.id === draggingId)
                  if (!t) return null
                  const stat = subtaskStats.get(t.id)
                  return (
                    <div className="rotate-1 scale-[1.02] shadow-[0_20px_40px_rgba(15,23,42,0.20)]">
                      <TaskCard
                        task={t}
                        persona={t.persona_id ? personasMap.get(t.persona_id) ?? null : null}
                        department={t.department_id ? deptMap.get(t.department_id) ?? null : null}
                        subtaskCount={stat?.total ?? 0}
                        completedSubs={stat?.done ?? 0}
                        onClick={() => {}}
                        onToggleStatus={() => {}}
                        selected={false}
                        onToggleSelect={() => {}}
                        selectionMode={false}
                      />
                    </div>
                  )
                })() : null}
              </DragOverlay>
            </Portal>
          </DndContext>
        ) : view === "list" ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                      <button onClick={toggleSelectAll} aria-label="Seleccionar todo" className="flex items-center justify-center">
                        {allSelected
                          ? <CheckSquare className="h-3.5 w-3.5 text-[#1e3a8a]" />
                          : <Square className="h-3.5 w-3.5 text-slate-400" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 w-8" />
                    {["Título", "Depto.", "Estado", "Prioridad", "Asignados", "Tags", "Vence", "Subtareas", ""].map((h, i) => (
                      <th key={i} className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(t => {
                    const overdue = isOverdue(t, terminalKeys)
                    const stat = subtaskStats.get(t.id)
                    const persona = t.persona_id ? personasMap.get(t.persona_id) : null
                    const isSelected = selectedIds.has(t.id)
                    return (
                      <tr key={t.id}
                        onClick={() => setSelected(t)}
                        className={`group border-b border-slate-100 cursor-pointer transition-colors ${
                          isSelected ? "bg-[#1e3a8a]/[0.04]" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <button onClick={() => toggleSelect(t.id)} className="flex items-center justify-center">
                            {isSelected
                              ? <CheckSquare className="h-3.5 w-3.5 text-[#1e3a8a]" />
                              : <Square className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />}
                          </button>
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => cycleStatus(t)}
                            className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${
                              terminalKeys.has(t.status)
                                ? "bg-emerald-500 border-emerald-500"
                                : "border-slate-300 hover:border-slate-500"
                            }`}
                          />
                        </td>

                        <td className="px-3 py-3">
                          <div className={`text-[13px] font-medium ${
                            terminalKeys.has(t.status) ? "text-slate-400 line-through" : "text-slate-900"
                          }`}>
                            {t.title}
                          </div>
                          {persona && (
                            <span className="mt-0.5 inline-block rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400">
                              ↳ {persona.name}
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          {(() => {
                            const dept = t.department_id ? deptMap.get(t.department_id) : null
                            if (!dept) return <span className="text-slate-300 text-[11px]">—</span>
                            return (
                              <span
                                className="rounded-full border px-2 py-0.5 text-[10px] font-bold"
                                style={{ borderColor: dept.color + "40", backgroundColor: dept.color + "15", color: dept.color }}
                              >
                                {dept.name}
                              </span>
                            )
                          })()}
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          {(() => {
                            const def = activeSet.statuses.find(s => s.key === t.status)
                            const color = def?.color ?? "#94a3b8"
                            const label = def?.label ?? t.status.replace("_", " ")
                            return (
                              <span
                                className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                                style={statusInlineStyle(color)}
                              >
                                {label}
                              </span>
                            )
                          })()}
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PRIORITY_STYLE[t.priority].pill}`}>
                            <Flag className="h-2.5 w-2.5" /> {t.priority}
                          </span>
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          <AvatarStack users={t.assignees} />
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap max-w-[200px]">
                          <div className="flex flex-wrap gap-1">
                            {t.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">{tag}</span>
                            ))}
                            {t.tags.length > 3 && <span className="text-[10px] text-slate-400">+{t.tags.length - 3}</span>}
                          </div>
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          {t.due_at ? (
                            <span className={`flex items-center gap-1 text-[11px] ${overdue ? "text-[#E42D2C] font-semibold" : "text-slate-500"}`}>
                              {overdue ? <AlertCircle className="h-3 w-3" /> : <CalIcon className="h-3 w-3" />}
                              {fmtDateTime(t.due_at)}
                            </span>
                          ) : <span className="text-slate-300 text-[11px]">—</span>}
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap text-[11px] text-slate-500">
                          {stat ? `${stat.done}/${stat.total}` : "—"}
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#1e3a8a] transition-colors" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* CALENDAR VIEW */
          <CalendarView
            tasks={sorted.map(t => ({
              id: t.id, title: t.title, status: t.status, priority: t.priority,
              due_at: t.due_at, assignees: t.assignees,
            }))}
            onTaskClick={id => {
              const t = tasks.find(x => x.id === id)
              if (t) setSelected(t)
            }}
            onDayClick={iso => {
              setNewPrefillDate(iso)
              setShowNewForm(true)
            }}
          />
        )}
      </div>
    </>
  )
}
