"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Portal } from "@/components/ui/portal"
import {
  Loader2, Trash2, RefreshCw, Plus, X, Calendar as CalIcon,
  Flag, ChevronRight, AlertCircle, Tag as TagIcon,
  LayoutGrid, List, GitBranch, Send,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS    = ["pendiente", "en_progreso", "completada", "cancelada"] as const
const PRIORITY_OPTIONS  = ["baja", "media", "alta", "urgente"] as const

type Status   = typeof STATUS_OPTIONS[number]
type Priority = typeof PRIORITY_OPTIONS[number]

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
function isOverdue(t: Task) {
  if (!t.due_at) return false
  if (t.status === "completada" || t.status === "cancelada") return false
  return new Date(t.due_at).getTime() < Date.now()
}
function initials(s: string) {
  return s.split(/[\s@]/).map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
}

const STATUS_COLUMNS: { key: Status; label: string; accent: string }[] = [
  { key: "pendiente",   label: "Pendiente",   accent: "bg-white/[0.05] border-white/15"          },
  { key: "en_progreso", label: "En progreso", accent: "bg-blue-500/10  border-blue-500/30"       },
  { key: "completada",  label: "Completadas", accent: "bg-emerald-500/10 border-emerald-500/30"  },
  { key: "cancelada",   label: "Canceladas",  accent: "bg-zinc-500/10  border-zinc-500/30"       },
]

const PRIORITY_STYLE: Record<Priority, { flag: string; pill: string }> = {
  baja:    { flag: "text-zinc-400",   pill: "text-zinc-300  border-zinc-400/25  bg-zinc-400/10"   },
  media:   { flag: "text-amber-300",  pill: "text-amber-300 border-amber-400/25 bg-amber-400/10"  },
  alta:    { flag: "text-orange-300", pill: "text-orange-300 border-orange-400/25 bg-orange-400/10"},
  urgente: { flag: "text-red-300",    pill: "text-red-300   border-red-500/25   bg-red-500/10"   },
}

const STATUS_STYLE: Record<Status, string> = {
  pendiente:   "text-white/70    border-white/15        bg-white/[0.03]",
  en_progreso: "text-blue-300    border-blue-500/30     bg-blue-500/10",
  completada:  "text-emerald-300 border-emerald-500/30  bg-emerald-500/10",
  cancelada:   "text-zinc-400    border-zinc-500/30     bg-zinc-500/10",
}

// ─── Reusable input class ─────────────────────────────────────────────────────
const inputCls = "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none transition-all"

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
          className={`${dim} flex items-center justify-center rounded-full border border-[#0d1745] bg-gradient-to-br from-[#E42D2C]/40 to-[#152978] font-bold text-white`}>
          {initials(u)}
        </div>
      ))}
      {extra > 0 && (
        <div className={`${dim} flex items-center justify-center rounded-full border border-[#0d1745] bg-white/10 text-white/70 font-bold`}>
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
          <span key={t} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/80">
            <TagIcon className="h-2.5 w-2.5 text-white/40" />
            {t}
            <button onClick={() => remove(t)} className="text-white/30 hover:text-red-400 transition-colors ml-0.5">
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
        className="h-7 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] text-white placeholder:text-white/35 focus:border-white/20 focus:outline-none"
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
          <span key={a} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] pl-1 pr-2 py-0.5 text-[11px] text-white/80">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#E42D2C]/40 to-[#152978] text-[8px] font-bold text-white">
              {initials(a)}
            </span>
            {a}
            <button onClick={() => remove(a)} className="text-white/30 hover:text-red-400 transition-colors">
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
        className="h-7 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] text-white placeholder:text-white/35 focus:border-white/20 focus:outline-none"
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
        <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-white/30" /></div>
      ) : comments.length === 0 ? (
        <p className="text-[12px] text-white/30 text-center py-3">Sin actividad todavía.</p>
      ) : (
        <div className="space-y-2">
          {comments.map(c => (
            <div key={c.id} className={`flex items-start gap-2 rounded-xl px-3 py-2 ${c.kind === "system" ? "" : "border border-white/[0.06] bg-white/[0.02]"}`}>
              {c.kind === "system" ? (
                <span className="h-1 w-1 mt-2 rounded-full bg-white/30 shrink-0" />
              ) : (
                <span className="flex h-6 w-6 mt-0.5 items-center justify-center rounded-full bg-gradient-to-br from-[#E42D2C]/40 to-[#152978] text-[9px] font-bold text-white shrink-0">
                  {initials(c.author ?? "?")}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-white/35">
                    {c.kind === "system" ? "" : <span className="font-semibold text-white/55">{c.author}</span>}
                    {c.kind === "system" ? "" : " · "}
                    {fmtRelative(c.created_at)}
                  </p>
                  {c.kind === "comment" && (
                    <button onClick={() => del(c.id)} className="text-white/15 hover:text-red-400 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className={`text-[13px] ${c.kind === "system" ? "text-white/45 italic" : "text-white/85"}`}>
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
          className="h-9 flex-1 rounded-lg border border-white/[0.08] bg-[#080d1e] px-3 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-white/20"
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

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  task, allTasks, personas, onClose, onPatch, onDelete, deleting, onCreateSubtask,
}: {
  task:            Task
  allTasks:        Task[]
  personas:        PersonaLite[]
  onClose:         () => void
  onPatch:         (id: string, updates: Partial<Task>) => void
  onDelete:        (id: string) => void
  deleting:        boolean
  onCreateSubtask: (parentId: string, title: string) => Promise<void>
}) {
  const subtasks = allTasks.filter(t => t.parent_id === task.id)
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
      <div className="fixed inset-0 z-[100] bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-[110] flex w-full max-w-[520px] flex-col border-l border-white/[0.08] shadow-2xl" style={{ backgroundColor: "#0d1745" }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              defaultValue={task.title}
              onBlur={e => { const v = e.target.value.trim(); if (v && v !== task.title) onPatch(task.id, { title: v }) }}
              className="w-full bg-transparent text-lg font-bold text-white outline-none"
            />
            <p className="text-[12px] text-white/35 mt-0.5">
              Creada {fmtDateTime(task.created_at)}{task.created_by ? ` · ${task.created_by}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onDelete(task.id)} disabled={deleting}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06] px-6">
          {[
            { k: "detail" as const, l: "Detalle" },
            { k: "comments" as const, l: "Actividad" },
          ].map(t => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`px-4 py-3 text-[12px] font-bold uppercase tracking-widest transition-colors border-b-2 ${
                tab === t.k
                  ? "border-[#E42D2C] text-white"
                  : "border-transparent text-white/35 hover:text-white/70"
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
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Estado</p>
                  <select
                    value={task.status}
                    onChange={e => onPatch(task.id, { status: e.target.value as Status })}
                    className={inputCls + " capitalize"}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s} className="bg-[#0d1745] text-white capitalize">{s.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Prioridad</p>
                  <select
                    value={task.priority}
                    onChange={e => onPatch(task.id, { priority: e.target.value as Priority })}
                    className={inputCls + " capitalize"}
                  >
                    {PRIORITY_OPTIONS.map(p => (
                      <option key={p} value={p} className="bg-[#0d1745] text-white capitalize">{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due date */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Vence</p>
                <input
                  type="datetime-local"
                  defaultValue={toLocalInputValue(task.due_at)}
                  onBlur={e => onPatch(task.id, { due_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className={inputCls}
                />
              </div>

              {/* Assignees */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Asignados</p>
                <AssigneesEditor value={task.assignees ?? []} onChange={v => onPatch(task.id, { assignees: v })} />
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Tags</p>
                <TagsEditor value={task.tags ?? []} onChange={v => onPatch(task.id, { tags: v })} />
              </div>

              {/* Linked persona */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Vinculada a persona agendada</p>
                <select
                  value={task.persona_id ?? ""}
                  onChange={e => onPatch(task.id, { persona_id: e.target.value || null })}
                  className={inputCls}
                >
                  <option value="" className="bg-[#0d1745] text-white">— Ninguna —</option>
                  {personas.map(p => (
                    <option key={p.id} value={p.id} className="bg-[#0d1745] text-white">{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Descripción</p>
                <textarea
                  defaultValue={task.description ?? ""}
                  placeholder="Detalle de la tarea..."
                  rows={5}
                  onBlur={e => onPatch(task.id, { description: e.target.value || null })}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Subtasks */}
              <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5 text-white/40" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Subtareas</p>
                  <span className="text-[11px] text-white/30">({subtasks.length})</span>
                </div>

                {subtasks.length > 0 && (
                  <div className="space-y-1">
                    {subtasks.map(s => (
                      <div key={s.id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                        <button
                          onClick={() => onPatch(s.id, { status: s.status === "completada" ? "pendiente" : "completada" })}
                          className={`shrink-0 h-3 w-3 rounded-full border-2 transition-all ${
                            s.status === "completada" ? "bg-emerald-400 border-emerald-400" : "border-white/30 hover:border-white/60"
                          }`}
                        />
                        <span className={`flex-1 text-[12px] ${s.status === "completada" ? "text-white/40 line-through" : "text-white/85"}`}>
                          {s.title}
                        </span>
                        <button onClick={() => onDelete(s.id)} className="text-white/15 hover:text-red-400 transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={submitSub} className="flex gap-2">
                  <input
                    value={newSub}
                    onChange={e => setNewSub(e.target.value)}
                    placeholder="Sumar subtarea..."
                    className="h-8 flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 text-[12px] text-white placeholder:text-white/30 outline-none focus:border-white/15"
                  />
                  <button
                    type="submit"
                    disabled={!newSub.trim() || savingSub}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-white/60 hover:bg-white/[0.10] hover:text-white disabled:opacity-30 transition-all"
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
  personas, onClose, onCreate, creating,
}: {
  personas: PersonaLite[]
  onClose:  () => void
  onCreate: (data: Partial<Task>) => Promise<void>
  creating: boolean
}) {
  const [title,       setTitle]       = useState("")
  const [description, setDescription] = useState("")
  const [priority,    setPriority]    = useState<Priority>("media")
  const [assignees,   setAssignees]   = useState<string[]>([])
  const [tags,        setTags]        = useState<string[]>([])
  const [dueAt,       setDueAt]       = useState("")
  const [personaId,   setPersonaId]   = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await onCreate({
      title:       title.trim(),
      description: description.trim() || null,
      priority,
      assignees,
      tags,
      due_at:      dueAt ? new Date(dueAt).toISOString() : null,
      persona_id:  personaId || null,
    })
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-2xl border border-white/[0.10] shadow-2xl p-6 space-y-3.5 max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: "#0d1745" }}
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-white">Nueva tarea</h3>
            <button type="button" onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Título *</p>
            <input autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="¿Qué hay que hacer?" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Descripción</p>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalle..." rows={3} className={`${inputCls} resize-none`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Prioridad</p>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className={inputCls + " capitalize"}>
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p} className="bg-[#0d1745] capitalize">{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Vence</p>
              <input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Asignados</p>
            <AssigneesEditor value={assignees} onChange={setAssignees} />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Tags</p>
            <TagsEditor value={tags} onChange={setTags} />
          </div>

          {personas.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Vincular a persona agendada</p>
              <select value={personaId} onChange={e => setPersonaId(e.target.value)} className={inputCls}>
                <option value="" className="bg-[#0d1745]">— Ninguna —</option>
                {personas.map(p => <option key={p.id} value={p.id} className="bg-[#0d1745]">{p.name}</option>)}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={!title.trim() || creating}
            className="w-full h-10 rounded-xl bg-[#E42D2C] text-white text-[13px] font-bold hover:bg-[#c42423] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Crear tarea
          </button>
        </form>
      </div>
    </Portal>
  )
}

// ─── Task Card (kanban) ───────────────────────────────────────────────────────

function TaskCard({
  task, persona, subtaskCount, completedSubs, onClick, onToggleStatus,
}: {
  task: Task
  persona: PersonaLite | null
  subtaskCount: number
  completedSubs: number
  onClick: () => void
  onToggleStatus: (next: Status) => void
}) {
  const overdue = isOverdue(task)
  const due = fmtDateTime(task.due_at)

  const nextStatus: Status =
    task.status === "pendiente"   ? "en_progreso" :
    task.status === "en_progreso" ? "completada"  :
    task.status === "completada"  ? "pendiente"   :
                                    "pendiente"

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl border border-white/[0.07] bg-[#0d1745] hover:border-white/[0.15] hover:shadow-[0_0_24px_rgba(228,45,44,0.05)] transition-all p-3 space-y-2"
    >
      <div className="flex items-start gap-2">
        <button
          onClick={e => { e.stopPropagation(); onToggleStatus(nextStatus) }}
          className={`shrink-0 mt-1 h-3 w-3 rounded-full border-2 transition-all ${
            task.status === "completada" ? "bg-emerald-400 border-emerald-400" :
            task.status === "en_progreso" ? "border-blue-400" :
            task.status === "cancelada"   ? "border-zinc-500" :
                                            "border-white/30 hover:border-white/60"
          }`}
        />
        <p className={`flex-1 text-[13px] font-medium leading-snug ${task.status === "completada" || task.status === "cancelada" ? "text-white/40 line-through" : "text-white"}`}>
          {task.title}
        </p>
        <Flag className={`shrink-0 h-3 w-3 ${PRIORITY_STYLE[task.priority].flag}`} />
      </div>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-5">
          {task.tags.slice(0, 4).map(t => (
            <span key={t} className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/60">{t}</span>
          ))}
          {task.tags.length > 4 && <span className="text-[10px] text-white/40">+{task.tags.length - 4}</span>}
        </div>
      )}

      {/* Metadata row */}
      <div className="flex items-center justify-between gap-2 pl-5">
        <div className="flex items-center gap-2.5 text-[11px] text-white/40">
          {subtaskCount > 0 && (
            <span className="flex items-center gap-1" title="Subtareas">
              <GitBranch className="h-3 w-3" />
              {completedSubs}/{subtaskCount}
            </span>
          )}
          {due && (
            <span className={`flex items-center gap-1 ${overdue ? "text-red-300" : ""}`}>
              {overdue ? <AlertCircle className="h-3 w-3" /> : <CalIcon className="h-3 w-3" />}
              {due}
            </span>
          )}
        </div>
        <AvatarStack users={task.assignees} />
      </div>

      {persona && (
        <div className="pl-5">
          <span className="inline-block rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/50">
            ↳ {persona.name}
          </span>
        </div>
      )}
    </div>
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
  const [showNewForm,   setShowNewForm]   = useState(false)
  const [creating,      setCreating]      = useState(false)
  const [view,          setView]          = useState<"board" | "list">("board")

  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  // Quick-action: open "Nueva tarea" modal when ?new=1 is present, then strip the param.
  useEffect(() => {
    if (searchParams?.get("new") === "1") {
      setShowNewForm(true)
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
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const [tRes, pRes] = await Promise.all([
        fetch("/api/admin/tasks?include_subtasks=true", { headers }),
        fetch("/api/admin/personas",                     { headers }),
      ])
      if (tRes.ok) setTasks((await tRes.json()).tasks ?? [])
      if (pRes.ok) {
        const j = await pRes.json()
        setPersonas((j.personas ?? []).map((p: any) => ({ id: p.id, name: p.name })))
      }
    } finally { setLoading(false) }
  }, [])

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
      }
    } finally { setCreating(false) }
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

  const patch = async (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...updates } : prev)
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/tasks", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id, ...updates }),
    })
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/tasks", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id }),
    })
    setTasks(prev => prev.filter(t => t.id !== id && t.parent_id !== id))
    if (selected?.id === id) setSelected(null)
    setDeletingId(null)
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

  const filtered = useMemo(() => topLevel.filter(t => {
    if (filterAssignee !== "todos" && !t.assignees?.includes(filterAssignee)) return false
    if (filterTag !== "todos" && !t.tags?.includes(filterTag)) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [t.title, t.description, ...(t.assignees ?? []), ...(t.tags ?? [])]
      .some(v => v?.toLowerCase().includes(q))
  }), [topLevel, search, filterAssignee, filterTag])

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
    const g: Record<Status, Task[]> = { pendiente: [], en_progreso: [], completada: [], cancelada: [] }
    filtered.forEach(t => g[t.status].push(t))
    return g
  }, [filtered])

  const overdueCount = useMemo(() => filtered.filter(isOverdue).length, [filtered])

  return (
    <>
      {showNewForm && (
        <NewTaskModal personas={personas} onClose={() => setShowNewForm(false)} onCreate={handleCreate} creating={creating} />
      )}

      {selected && (
        <DetailDrawer
          task={selected}
          allTasks={tasks}
          personas={personas}
          onClose={() => setSelected(null)}
          onPatch={patch}
          onDelete={handleDelete}
          deleting={deletingId === selected.id}
          onCreateSubtask={createSubtask}
        />
      )}

      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Tareas</h1>
            <p className="text-sm text-white/40 mt-0.5">
              {topLevel.length} {topLevel.length === 1 ? "tarea" : "tareas"}
              {overdueCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-red-300">
                  · <AlertCircle className="h-3 w-3" /> {overdueCount} vencidas
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="inline-flex h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5">
              <button
                onClick={() => setView("board")}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all ${
                  view === "board" ? "bg-white/[0.10] text-white" : "text-white/45 hover:text-white"
                }`}>
                <LayoutGrid className="h-3.5 w-3.5" /> Board
              </button>
              <button
                onClick={() => setView("list")}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all ${
                  view === "list" ? "bg-white/[0.10] text-white" : "text-white/45 hover:text-white"
                }`}>
                <List className="h-3.5 w-3.5" /> Lista
              </button>
            </div>

            <button onClick={fetchAll} disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 h-9 rounded-xl bg-[#E42D2C] px-4 text-sm font-bold text-white hover:bg-[#c42423] transition-all">
              <Plus className="h-3.5 w-3.5" />
              Nueva tarea
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tareas, tags, asignados..."
            className="h-9 rounded-xl border border-white/[0.08] bg-[#080d1e] px-4 text-sm text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none flex-1 min-w-[220px] max-w-sm"
          />
          {allAssignees.length > 0 && (
            <select
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
              className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-white outline-none cursor-pointer">
              <option value="todos" className="bg-[#0d1745]">Todos los asignados</option>
              {allAssignees.map(a => <option key={a} value={a} className="bg-[#0d1745]">{a}</option>)}
            </select>
          )}
          {allTags.length > 0 && (
            <select
              value={filterTag}
              onChange={e => setFilterTag(e.target.value)}
              className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-white outline-none cursor-pointer">
              <option value="todos" className="bg-[#0d1745]">Todos los tags</option>
              {allTags.map(t => <option key={t} value={t} className="bg-[#0d1745]">{t}</option>)}
            </select>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
          </div>
        ) : view === "board" ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            {STATUS_COLUMNS.map(col => {
              const list = grouped[col.key]
              return (
                <div key={col.key} className="flex flex-col rounded-2xl border border-white/[0.05] bg-white/[0.01] min-h-[200px]">
                  <div className={`flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3 rounded-t-2xl ${col.accent}`}>
                    <h3 className="text-[12px] font-bold uppercase tracking-widest text-white/85">{col.label}</h3>
                    <span className="text-[11px] font-semibold text-white/50">{list.length}</span>
                  </div>
                  <div className="flex-1 p-3 space-y-2">
                    {list.length === 0 ? (
                      <p className="py-4 text-center text-[12px] text-white/25">—</p>
                    ) : list.map(t => {
                      const stat = subtaskStats.get(t.id)
                      return (
                        <TaskCard
                          key={t.id}
                          task={t}
                          persona={t.persona_id ? personasMap.get(t.persona_id) ?? null : null}
                          subtaskCount={stat?.total ?? 0}
                          completedSubs={stat?.done ?? 0}
                          onClick={() => setSelected(t)}
                          onToggleStatus={ns => patch(t.id, { status: ns })}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1745]">
            {filtered.length === 0 ? (
              <p className="py-16 text-center text-sm text-white/25">No hay tareas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                      {["", "Título", "Estado", "Prioridad", "Asignados", "Tags", "Vence", "Subtareas", ""].map((h, i) => (
                        <th key={i} className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-white/40 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => {
                      const overdue = isOverdue(t)
                      const stat = subtaskStats.get(t.id)
                      const persona = t.persona_id ? personasMap.get(t.persona_id) : null
                      return (
                        <tr key={t.id}
                          onClick={() => setSelected(t)}
                          className="border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-white/[0.02]">

                          <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => patch(t.id, { status: t.status === "completada" ? "pendiente" : "completada" })}
                              className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${
                                t.status === "completada" ? "bg-emerald-400 border-emerald-400" :
                                t.status === "en_progreso" ? "border-blue-400" :
                                t.status === "cancelada"   ? "border-zinc-500" :
                                                              "border-white/30 hover:border-white/60"
                              }`}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <div className={`text-[13px] font-medium ${t.status === "completada" || t.status === "cancelada" ? "text-white/40 line-through" : "text-white"}`}>
                              {t.title}
                            </div>
                            {persona && (
                              <span className="mt-0.5 inline-block rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/40">
                                ↳ {persona.name}
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[t.status]}`}>
                              {t.status.replace("_", " ")}
                            </span>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide ${PRIORITY_STYLE[t.priority].flag}`}>
                              <Flag className="h-3 w-3" /> {t.priority}
                            </span>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <AvatarStack users={t.assignees} />
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap max-w-[200px]">
                            <div className="flex flex-wrap gap-1">
                              {t.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/60">{tag}</span>
                              ))}
                              {t.tags.length > 3 && <span className="text-[10px] text-white/40">+{t.tags.length - 3}</span>}
                            </div>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {t.due_at ? (
                              <span className={`flex items-center gap-1 text-[11px] ${overdue ? "text-red-300" : "text-white/55"}`}>
                                {overdue ? <AlertCircle className="h-3 w-3" /> : <CalIcon className="h-3 w-3" />}
                                {fmtDateTime(t.due_at)}
                              </span>
                            ) : <span className="text-white/25 text-[11px]">—</span>}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap text-[11px] text-white/55">
                            {stat ? `${stat.done}/${stat.total}` : "—"}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <ChevronRight className="h-4 w-4 text-white/25 group-hover:text-white/60 transition-colors" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
