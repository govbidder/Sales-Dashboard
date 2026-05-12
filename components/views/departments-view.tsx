"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Portal } from "@/components/ui/portal"
import type { Department } from "@/lib/types/department"
import { isAdminOrAbove, type Role } from "@/lib/types/role"
import {
  Loader2, Plus, X, Trash2, RefreshCw, Layers, Users2, ListTodo,
  GripVertical, AlertCircle,
} from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HEX_RE = /^#[0-9a-fA-F]{6}$/

const PRESET_COLORS = [
  "#8b5cf6", "#f59e0b", "#ef4444", "#22c55e", "#3b82f6",
  "#ec4899", "#14b8a6", "#0ea5e9", "#a855f7", "#f97316",
]

const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a]/40 focus:outline-none transition-all"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Counts {
  tasks:   number
  members: number
}

// ─── New Department Modal ─────────────────────────────────────────────────────

function NewDeptModal({
  onClose, onCreate, creating, existingNames,
}: {
  onClose:        () => void
  onCreate:       (data: { name: string; description: string; color: string; sort_order: number }) => Promise<{ error?: string }>
  creating:       boolean
  existingNames:  string[]
}) {
  const [name,        setName]        = useState("")
  const [description, setDescription] = useState("")
  const [color,       setColor]       = useState(PRESET_COLORS[0])
  const [sortOrder,   setSortOrder]   = useState<number>(existingNames.length + 1)
  const [error,       setError]       = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError("El nombre es requerido")
    if (existingNames.includes(n.toLowerCase())) return setError("Ya existe un departamento con ese nombre")
    if (!HEX_RE.test(color)) return setError("Color inválido (debe ser HEX #RRGGBB)")
    setError(null)
    const result = await onCreate({ name: n, description: description.trim(), color, sort_order: sortOrder })
    if (result.error) setError(result.error)
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-md" onClick={onClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="relative w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden rounded-3xl border border-slate-200 shadow-[0_30px_80px_rgba(15,23,42,0.20)]"
          style={{ backgroundColor: "#ffffff" }}
        >
          <div className="relative shrink-0 px-6 pt-6 pb-5 border-b border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6b6a] to-[#c42423] shadow-[0_0_24px_rgba(228,45,44,0.30)]">
                <Layers className="h-5 w-5 text-white" />
              </span>
              <div className="pt-1">
                <h3 className="text-[18px] font-bold tracking-tight text-slate-900 leading-none">
                  Nuevo departamento
                </h3>
                <p className="mt-2 text-[12px] text-slate-500 leading-relaxed">
                  Los departamentos organizan tareas y miembros por área.
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">Nombre *</p>
              <input
                autoFocus type="text" value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ej: Ventas"
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">Descripción</p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="Para qué es esta área"
                className={`${inputCls} resize-none`}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">Color</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-8 w-8 rounded-full ring-2 transition-all ${color === c ? "ring-slate-900 scale-110" : "ring-transparent hover:ring-slate-300"}`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="h-8 w-8 rounded-full border border-slate-200 cursor-pointer"
                  title="Color custom"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">Orden</p>
              <input
                type="number" min={0} value={sortOrder}
                onChange={e => setSortOrder(parseInt(e.target.value) || 0)}
                className={inputCls}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="flex w-full items-center justify-center gap-2 h-11 rounded-xl bg-[#E42D2C] text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(228,45,44,0.25)] hover:bg-[#c42423] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</> : <><Plus className="h-4 w-4" /> Crear departamento</>}
            </button>
          </div>
        </form>
      </div>
    </Portal>
  )
}

// ─── Department Card (inline editable) ────────────────────────────────────────

function DeptCard({
  dept, counts, isAdmin, onPatch, onDelete, deleting,
}: {
  dept:     Department
  counts:   Counts
  isAdmin:  boolean
  onPatch:  (id: string, updates: Partial<Department>) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-[0_0_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-3 mb-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-bold text-white shadow-sm"
          style={{ backgroundColor: dept.color }}
        >
          {dept.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          {isAdmin ? (
            <input
              type="text"
              defaultValue={dept.name}
              onBlur={e => {
                const v = e.target.value.trim()
                if (v && v !== dept.name) onPatch(dept.id, { name: v })
                else e.target.value = dept.name
              }}
              className="w-full bg-transparent text-base font-bold text-slate-900 outline-none border-b border-transparent hover:border-slate-200 focus:border-slate-300 transition-colors"
            />
          ) : (
            <h3 className="text-base font-bold text-slate-900 truncate">{dept.name}</h3>
          )}
          {isAdmin ? (
            <textarea
              defaultValue={dept.description ?? ""}
              placeholder="Sin descripción"
              rows={2}
              onBlur={e => {
                const v = e.target.value.trim()
                if (v !== (dept.description ?? "")) onPatch(dept.id, { description: v || null })
              }}
              className="mt-1 w-full bg-transparent text-[12px] text-slate-500 placeholder:text-slate-300 outline-none resize-none border-b border-transparent hover:border-slate-200 focus:border-slate-300 transition-colors"
            />
          ) : (
            <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{dept.description || "Sin descripción"}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">
            <Users2 className="h-3 w-3" /> Miembros
          </div>
          <p className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">{counts.members}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">
            <ListTodo className="h-3 w-3" /> Tareas
          </div>
          <p className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">{counts.tasks}</p>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <GripVertical className="h-3 w-3" /> Orden:
              <input
                type="number" min={0} defaultValue={dept.sort_order}
                onBlur={e => {
                  const v = parseInt(e.target.value)
                  if (!Number.isNaN(v) && v !== dept.sort_order) onPatch(dept.id, { sort_order: v })
                }}
                className="w-14 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-900 outline-none focus:border-slate-300"
              />
            </label>
            <input
              type="color"
              defaultValue={dept.color}
              onBlur={e => {
                if (e.target.value !== dept.color && HEX_RE.test(e.target.value)) {
                  onPatch(dept.id, { color: e.target.value })
                }
              }}
              className="h-6 w-6 rounded-full border border-slate-200 cursor-pointer"
              title="Cambiar color"
            />
          </div>

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => onDelete(dept.id)}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {deleting ? "..." : "Confirmar"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
              title="Eliminar departamento"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function DepartmentsView() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showNew,     setShowNew]     = useState(false)
  const [creating,    setCreating]    = useState(false)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [isAdmin,     setIsAdmin]     = useState(false)
  const [counts,      setCounts]      = useState<Record<string, Counts>>({})
  const [error,       setError]       = useState<string | null>(null)

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
      const supabase = createClient()
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", session.user.id).single()
      setIsAdmin(isAdminOrAbove(profile?.role as Role | undefined))

      const headers = { Authorization: `Bearer ${session.access_token}` }
      const [dRes, tRes, mRes] = await Promise.all([
        fetch("/api/departments",  { headers }),
        fetch("/api/admin/tasks?include_subtasks=true", { headers }),
        fetch("/api/admin/team",   { headers }),
      ])

      const depts: Department[] = dRes.ok ? (await dRes.json()).departments ?? [] : []
      const tasks: { department_id: string | null }[] = tRes.ok ? (await tRes.json()).tasks ?? [] : []
      const members: { department_id: string | null }[] = mRes.ok ? (await mRes.json()).members ?? [] : []

      setDepartments(depts)

      const c: Record<string, Counts> = {}
      for (const d of depts) c[d.id] = { tasks: 0, members: 0 }
      for (const t of tasks) if (t.department_id && c[t.department_id]) c[t.department_id].tasks++
      for (const m of members) if (m.department_id && c[m.department_id]) c[m.department_id].members++
      setCounts(c)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleCreate = async (data: { name: string; description: string; color: string; sort_order: number }) => {
    setCreating(true)
    setError(null)
    try {
      const session = await getSession()
      if (!session) return { error: "Sin sesión" }
      const res = await fetch("/api/departments", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) return { error: json?.error ?? "Error creando" }
      setDepartments(prev => [...prev, json.department].sort((a, b) => a.sort_order - b.sort_order))
      setCounts(prev => ({ ...prev, [json.department.id]: { tasks: 0, members: 0 } }))
      setShowNew(false)
      return {}
    } finally { setCreating(false) }
  }

  const handlePatch = async (id: string, updates: Partial<Department>) => {
    const prev = departments
    setDepartments(curr =>
      curr.map(d => d.id === id ? { ...d, ...updates } as Department : d)
          .sort((a, b) => a.sort_order - b.sort_order)
    )
    setError(null)
    const session = await getSession()
    if (!session) return
    const res = await fetch(`/api/departments/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify(updates),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j?.error ?? "No se pudo guardar")
      setDepartments(prev)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setError(null)
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch(`/api/departments/${id}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        setDepartments(prev => prev.filter(d => d.id !== id))
      } else {
        const j = await res.json().catch(() => ({}))
        setError(j?.error ?? "No se pudo borrar")
      }
    } finally { setDeletingId(null) }
  }

  const existingNamesLower = useMemo(
    () => departments.map(d => d.name.toLowerCase()),
    [departments]
  )
  const totalTasks   = Object.values(counts).reduce((s, c) => s + c.tasks, 0)
  const totalMembers = Object.values(counts).reduce((s, c) => s + c.members, 0)

  return (
    <>
      {showNew && (
        <NewDeptModal
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
          creating={creating}
          existingNames={existingNamesLower}
        />
      )}

      <div className="space-y-6">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 -right-32 h-[400px] w-[400px] rounded-full bg-[#E42D2C]/[0.08] blur-[100px]" />
            <div className="absolute -bottom-24 -left-24 h-[300px] w-[300px] rounded-full bg-slate-100/40 blur-[100px]" />
          </div>

          <div className="relative grid lg:grid-cols-[1fr_auto] gap-4 p-6 sm:p-7 items-end">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E42D2C]/15 ring-1 ring-[#E42D2C]/30">
                  <Layers className="h-3.5 w-3.5 text-[#ff6b6a]" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#1e3a8a]">
                  Departamentos
                </span>
              </div>
              <h1 className="text-[32px] sm:text-[40px] font-bold tracking-tight text-slate-900 leading-[1.05]">
                {departments.length === 0 ? (
                  <>Sin departamentos aún</>
                ) : (
                  <>
                    <span className="text-slate-900">{departments.length}</span>{" "}
                    <span className="text-slate-800">{departments.length === 1 ? "departamento" : "departamentos"}</span>
                  </>
                )}
              </h1>
              <p className="text-sm text-slate-500 mt-2">
                Organizá tareas y miembros del equipo por área.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={fetchAll}
                disabled={loading}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-all disabled:opacity-40"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowNew(true)}
                  className="flex items-center gap-2 h-10 rounded-xl bg-[#E42D2C] px-4 text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(228,45,44,0.25)] hover:bg-[#c42423] transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo
                </button>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="relative grid grid-cols-3 border-t border-slate-100">
            {[
              { label: "Departamentos",   val: departments.length },
              { label: "Miembros asignados", val: totalMembers },
              { label: "Tareas asignadas",   val: totalTasks },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`relative px-5 py-4 ${i < 2 ? "border-r border-slate-100" : ""}`}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1e3a8a]/80 mb-1.5">
                  {s.label}
                </div>
                <p className="text-[24px] font-bold tabular-nums text-slate-900 leading-none">
                  {s.val}
                </p>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
          </div>
        ) : departments.length === 0 ? (
          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white py-20 text-center">
            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E42D2C]/10 ring-1 ring-[#E42D2C]/25 mb-4">
              <Layers className="h-6 w-6 text-[#ff6b6a]" />
            </span>
            <h3 className="relative text-[16px] font-bold text-slate-900 mb-1">
              Creá el primer departamento
            </h3>
            <p className="relative max-w-sm text-[13px] text-slate-500 mb-5 px-4">
              Los departamentos te permiten agrupar tareas y miembros por área (ej: Marketing, IA, Ventas).
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-2 h-10 rounded-xl bg-[#E42D2C] px-4 text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(228,45,44,0.25)] hover:bg-[#c42423] transition-all"
              >
                <Plus className="h-4 w-4" />
                Crear primer departamento
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map(d => (
              <DeptCard
                key={d.id}
                dept={d}
                counts={counts[d.id] ?? { tasks: 0, members: 0 }}
                isAdmin={isAdmin}
                onPatch={handlePatch}
                onDelete={handleDelete}
                deleting={deletingId === d.id}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
