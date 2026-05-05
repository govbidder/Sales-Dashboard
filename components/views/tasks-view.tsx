"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Trash2, RefreshCw, Plus, X, Calendar as CalIcon,
  Flag, User, ChevronRight, AlertCircle,
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
  due_at:       string | null
  completed_at: string | null
  persona_id:   string | null
  created_by:   string | null
  created_at:   string
  updated_at:   string
}

interface PersonaLite {
  id:   string
  name: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
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

const STATUS_COLUMNS: { key: Status; label: string; accent: string }[] = [
  { key: "pendiente",   label: "Pendiente",   accent: "bg-white/[0.05] border-white/15"        },
  { key: "en_progreso", label: "En progreso", accent: "bg-blue-500/10  border-blue-500/30"      },
  { key: "completada",  label: "Completadas", accent: "bg-emerald-500/10 border-emerald-500/30" },
  { key: "cancelada",   label: "Canceladas",  accent: "bg-zinc-500/10  border-zinc-500/30"      },
]

const PRIORITY_STYLE: Record<Priority, { pill: string; flag: string }> = {
  baja:    { pill: "text-zinc-400  border-zinc-400/25  bg-zinc-400/10",   flag: "text-zinc-400"   },
  media:   { pill: "text-amber-300 border-amber-400/25 bg-amber-400/10",  flag: "text-amber-300"  },
  alta:    { pill: "text-orange-300 border-orange-400/25 bg-orange-400/10", flag: "text-orange-300" },
  urgente: { pill: "text-red-300   border-red-500/25   bg-red-500/10",    flag: "text-red-300"    },
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  task, personas, onClose, onPatch, onDelete, deleting,
}: {
  task:     Task
  personas: PersonaLite[]
  onClose:  () => void
  onPatch:  (id: string, updates: Partial<Task>) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const inputCls = "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none transition-all"

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[460px] flex-col border-l border-white/[0.08] shadow-2xl" style={{ backgroundColor: "#0d1745" }}>

        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              defaultValue={task.title}
              onBlur={e => { const v = e.target.value.trim(); if (v && v !== task.title) onPatch(task.id, { title: v }) }}
              className="w-full bg-transparent text-lg font-bold text-white outline-none focus:text-white truncate"
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

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

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

          {/* Owner + due */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Owner</p>
              <input
                type="text"
                defaultValue={task.owner ?? ""}
                placeholder="Asignar a..."
                onBlur={e => onPatch(task.id, { owner: e.target.value || null })}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Vence</p>
              <input
                type="datetime-local"
                defaultValue={toLocalInputValue(task.due_at)}
                onBlur={e => onPatch(task.id, { due_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className={inputCls}
              />
            </div>
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

        </div>
      </div>
    </>
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
  const [owner,       setOwner]       = useState("")
  const [dueAt,       setDueAt]       = useState("")
  const [personaId,   setPersonaId]   = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await onCreate({
      title:       title.trim(),
      description: description.trim() || null,
      priority,
      owner:       owner.trim() || null,
      due_at:      dueAt ? new Date(dueAt).toISOString() : null,
      persona_id:  personaId || null,
    })
  }

  const inputCls = "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none transition-all"

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Owner</p>
              <input type="text" value={owner} onChange={e => setOwner(e.target.value)} placeholder="Asignar a..." className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Vence</p>
            <input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} className={inputCls} />
          </div>

          {personas.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Vincular a persona agendada (opcional)</p>
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
    </>
  )
}

// ─── Task Card (used in kanban) ───────────────────────────────────────────────

function TaskCard({
  task, persona, onClick, onToggleStatus,
}: {
  task: Task
  persona: PersonaLite | null
  onClick: () => void
  onToggleStatus: (next: Status) => void
}) {
  const overdue = isOverdue(task)
  const due = fmtDateTime(task.due_at)

  // Click on next-status pill cycles forward
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

      {(task.owner || due) && (
        <div className="flex items-center justify-between gap-2 text-[11px] pl-5">
          {task.owner ? (
            <span className="flex items-center gap-1 text-white/45 truncate">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{task.owner}</span>
            </span>
          ) : <span />}
          {due && (
            <span className={`flex items-center gap-1 ${overdue ? "text-red-300" : "text-white/40"}`}>
              {overdue && <AlertCircle className="h-3 w-3 shrink-0" />}
              {!overdue && <CalIcon className="h-3 w-3 shrink-0" />}
              {due}
            </span>
          )}
        </div>
      )}

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
  const [tasks,        setTasks]        = useState<Task[]>([])
  const [personas,     setPersonas]     = useState<PersonaLite[]>([])
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<Task | null>(null)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [search,       setSearch]       = useState("")
  const [filterOwner,  setFilterOwner]  = useState<string>("todos")
  const [showNewForm,  setShowNewForm]  = useState(false)
  const [creating,     setCreating]     = useState(false)

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
        fetch("/api/admin/tasks",    { headers }),
        fetch("/api/admin/personas", { headers }),
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
    setTasks(prev => prev.filter(t => t.id !== id))
    if (selected?.id === id) setSelected(null)
    setDeletingId(null)
  }

  const owners = useMemo(
    () => Array.from(new Set(tasks.map(t => t.owner).filter((o): o is string => !!o))).sort(),
    [tasks]
  )

  const filtered = useMemo(() => tasks.filter(t => {
    if (filterOwner !== "todos" && t.owner !== filterOwner) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [t.title, t.description, t.owner].some(v => v?.toLowerCase().includes(q))
  }), [tasks, search, filterOwner])

  const personasMap = useMemo(() => {
    const m = new Map<string, PersonaLite>()
    personas.forEach(p => m.set(p.id, p))
    return m
  }, [personas])

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
          personas={personas}
          onClose={() => setSelected(null)}
          onPatch={patch}
          onDelete={handleDelete}
          deleting={deletingId === selected.id}
        />
      )}

      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Tareas</h1>
            <p className="text-sm text-white/40 mt-0.5">
              {tasks.length} {tasks.length === 1 ? "tarea" : "tareas"}
              {overdueCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-red-300">
                  · <AlertCircle className="h-3 w-3" /> {overdueCount} vencidas
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            placeholder="Buscar tareas..."
            className="h-9 rounded-xl border border-white/[0.08] bg-[#1c1c1f] px-4 text-sm text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none flex-1 min-w-[220px] max-w-sm"
          />
          {owners.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFilterOwner("todos")}
                className={`h-8 rounded-xl border px-3 text-[12px] font-medium transition-all ${
                  filterOwner === "todos"
                    ? "border-[#E42D2C]/40 bg-[#E42D2C]/10 text-[#E42D2C]"
                    : "border-white/[0.07] text-white/40 hover:text-white hover:border-white/20"
                }`}>
                Todos
              </button>
              {owners.map(o => (
                <button
                  key={o}
                  onClick={() => setFilterOwner(filterOwner === o ? "todos" : o)}
                  className={`h-8 rounded-xl border px-3 text-[12px] font-medium transition-all ${
                    filterOwner === o
                      ? "border-white/30 bg-white/[0.06] text-white"
                      : "border-white/[0.07] text-white/40 hover:text-white hover:border-white/20"
                  }`}>
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Kanban */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
          </div>
        ) : (
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
                    ) : list.map(t => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        persona={t.persona_id ? personasMap.get(t.persona_id) ?? null : null}
                        onClick={() => setSelected(t)}
                        onToggleStatus={ns => patch(t.id, { status: ns })}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
