"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { Portal } from "@/components/ui/portal"
import {
  Loader2, Plus, X, Edit3, Trash2, RefreshCw, Layers,
  AlertCircle, Check, ChevronRight, Star, GitBranch,
  Calendar as CalIcon, Tag as TagIcon,
} from "lucide-react"

type Priority = "baja" | "media" | "alta" | "urgente"

interface Subtask {
  title:           string
  priority?:       Priority
  due_offset_days?: number | null
  tags?:           string[]
}

interface Template {
  id:                     string
  name:                   string
  description:            string | null
  icon:                   string | null
  color:                  string | null
  parent_title:           string
  parent_description:     string | null
  parent_priority:        Priority
  parent_tags:            string[]
  parent_assignees:       string[]
  parent_due_offset_days: number | null
  subtasks:               Subtask[]
  is_default:             boolean
  created_at:             string
}

const PRIORITY_PILL: Record<string, string> = {
  baja:    "border-zinc-300  bg-zinc-50    text-zinc-700",
  media:   "border-amber-300 bg-amber-50   text-amber-800",
  alta:    "border-orange-300 bg-orange-50 text-orange-800",
  urgente: "border-red-300   bg-red-50     text-[#E42D2C]",
}

// ─── Editor drawer ────────────────────────────────────────────────────────────

function TemplateEditor({
  template, onClose, onSaved,
}: {
  template: Template | null   // null = new
  onClose:  () => void
  onSaved:  (t: Template) => void
}) {
  const isNew = !template
  const [name,           setName]           = useState(template?.name ?? "")
  const [description,    setDescription]    = useState(template?.description ?? "")
  const [parentTitle,    setParentTitle]    = useState(template?.parent_title ?? "")
  const [parentDescription, setParentDescription] = useState(template?.parent_description ?? "")
  const [parentPriority, setParentPriority] = useState<Priority>(template?.parent_priority ?? "media")
  const [parentTags,     setParentTags]     = useState((template?.parent_tags ?? []).join(", "))
  const [parentAssignees, setParentAssignees] = useState((template?.parent_assignees ?? []).join(", "))
  const [parentOffset,   setParentOffset]   = useState(template?.parent_due_offset_days?.toString() ?? "")
  const [subtasks,       setSubtasks]       = useState<Subtask[]>(template?.subtasks ?? [])
  const [saving,         setSaving]         = useState(false)
  const [err,            setErr]            = useState<string | null>(null)

  const updateSub = (idx: number, next: Subtask) => {
    setSubtasks(prev => prev.map((s, i) => i === idx ? next : s))
  }
  const addSub = () => setSubtasks(prev => [...prev, { title: "", priority: "media", due_offset_days: null, tags: [] }])
  const removeSub = (idx: number) => setSubtasks(prev => prev.filter((_, i) => i !== idx))

  const save = async () => {
    if (!name.trim())       { setErr("Falta el nombre del template"); return }
    if (!parentTitle.trim()) { setErr("Falta el título de la tarea principal"); return }

    setSaving(true)
    setErr(null)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) return

      const payload = {
        name,
        description: description || null,
        parent_title: parentTitle,
        parent_description: parentDescription || null,
        parent_priority: parentPriority,
        parent_tags: parentTags.split(",").map(s => s.trim()).filter(Boolean),
        parent_assignees: parentAssignees.split(",").map(s => s.trim()).filter(Boolean),
        parent_due_offset_days: parentOffset ? parseInt(parentOffset, 10) : null,
        subtasks: subtasks.filter(s => s.title.trim()),
      }

      const url    = isNew ? "/api/admin/task-templates" : `/api/admin/task-templates/${template!.id}`
      const method = isNew ? "POST" : "PATCH"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify(payload),
      })
      const j = await res.json()
      if (!res.ok) { setErr(j.error || "No pude guardar"); return }
      onSaved(j.template)
    } finally { setSaving(false) }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-[110] flex w-full max-w-[640px] flex-col border-l border-slate-200 shadow-2xl bg-white">

        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {isNew ? "Nuevo template" : "Editar template"}
            </h3>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Plantilla pre-armada con tarea principal + subtasks.
            </p>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Template metadata */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Nombre del template *</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Nueva oportunidad de bid"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:border-[#1e3a8a]/40 focus:ring-2 focus:ring-[#1e3a8a]/10"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Descripción</p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Para qué sirve este workflow"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-[#1e3a8a]/40 focus:ring-2 focus:ring-[#1e3a8a]/10 resize-none"
            />
          </div>

          {/* Parent task */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">
              Tarea principal
            </p>

            <input
              type="text"
              value={parentTitle}
              onChange={e => setParentTitle(e.target.value)}
              placeholder="Ej: Bid: <nombre del RFP>"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-900 outline-none focus:border-[#1e3a8a]/40 focus:ring-2 focus:ring-[#1e3a8a]/10"
            />
            <textarea
              value={parentDescription}
              onChange={e => setParentDescription(e.target.value)}
              rows={2}
              placeholder="Descripción inicial de la tarea (opcional)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] text-slate-700 outline-none focus:border-[#1e3a8a]/40 resize-none"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={parentPriority}
                onChange={e => setParentPriority(e.target.value as Priority)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-900 outline-none cursor-pointer"
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
              <input
                type="number"
                value={parentOffset}
                onChange={e => setParentOffset(e.target.value)}
                placeholder="Días hasta vencer"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-900 outline-none focus:border-[#1e3a8a]/40"
              />
            </div>
            <input
              type="text"
              value={parentTags}
              onChange={e => setParentTags(e.target.value)}
              placeholder="Tags separados por coma"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-700 outline-none focus:border-[#1e3a8a]/40"
            />
            <input
              type="text"
              value={parentAssignees}
              onChange={e => setParentAssignees(e.target.value)}
              placeholder="Asignados (emails) separados por coma"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-700 outline-none focus:border-[#1e3a8a]/40"
            />
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">
                Subtareas ({subtasks.length})
              </p>
              <button
                type="button"
                onClick={addSub}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E42D2C] hover:text-[#c42423]"
              >
                <Plus className="h-3 w-3" /> Agregar
              </button>
            </div>

            {subtasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-6 text-center">
                <p className="text-[12px] text-slate-500">Sin subtareas todavía.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {subtasks.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2">
                    <span className="flex h-5 w-5 shrink-0 mt-0.5 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <input
                        type="text"
                        value={s.title}
                        onChange={e => updateSub(i, { ...s, title: e.target.value })}
                        placeholder="Título de la subtarea"
                        className="w-full text-[12.5px] font-medium text-slate-900 outline-none placeholder:text-slate-400"
                      />
                      <div className="flex items-center gap-1.5">
                        <select
                          value={s.priority ?? "media"}
                          onChange={e => updateSub(i, { ...s, priority: e.target.value as Priority })}
                          className="h-6 rounded border border-slate-200 bg-white px-1.5 text-[10px] outline-none cursor-pointer"
                        >
                          <option value="baja">baja</option>
                          <option value="media">media</option>
                          <option value="alta">alta</option>
                          <option value="urgente">urgente</option>
                        </select>
                        <input
                          type="number"
                          value={s.due_offset_days ?? ""}
                          onChange={e => updateSub(i, { ...s, due_offset_days: e.target.value ? parseInt(e.target.value, 10) : null })}
                          placeholder="+Nd"
                          className="h-6 w-14 rounded border border-slate-200 bg-white px-1.5 text-[10px] outline-none text-center"
                        />
                        <input
                          type="text"
                          value={(s.tags ?? []).join(",")}
                          onChange={e => updateSub(i, { ...s, tags: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })}
                          placeholder="tags,coma"
                          className="h-6 flex-1 rounded border border-slate-200 bg-white px-1.5 text-[10px] outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSub(i)}
                      className="text-slate-300 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {err && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-3 flex items-center justify-between gap-3">
          <button onClick={onClose} className="text-[12px] text-slate-500 hover:text-slate-900 px-2 py-1.5">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] hover:shadow-[0_4px_14px_rgba(228,45,44,0.25)] transition-all disabled:opacity-40"
          >
            {saving
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…</>
              : <><Check className="h-3.5 w-3.5" /> {isNew ? "Crear template" : "Guardar"}</>}
          </button>
        </div>
      </div>
    </Portal>
  )
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function TaskTemplatesAdminView() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editing,   setEditing]   = useState<Template | null | undefined>(undefined)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) return
      const res = await fetch("/api/admin/task-templates", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) setTemplates((await res.json()).templates ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const handleSaved = (t: Template) => {
    setTemplates(prev => {
      const idx = prev.findIndex(x => x.id === t.id)
      if (idx === -1) return [t, ...prev]
      return prev.map(x => x.id === t.id ? t : x)
    })
    setEditing(undefined)
  }

  const handleDelete = async (t: Template) => {
    if (t.is_default) {
      if (!confirm(`"${t.name}" es un template default. ¿Borrar igual? Se puede recuperar re-aplicando la migration.`)) return
    } else {
      if (!confirm(`¿Borrar "${t.name}"?`)) return
    }
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) return
    const res = await fetch(`/api/admin/task-templates/${t.id}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) setTemplates(prev => prev.filter(x => x.id !== t.id))
  }

  return (
    <>
      {editing !== undefined && (
        <TemplateEditor
          template={editing}
          onClose={() => setEditing(undefined)}
          onSaved={handleSaved}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a8a] tracking-tight">Templates de tareas</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {templates.length} {templates.length === 1 ? "template" : "templates"} · usalos desde el botón "Templates" en /admin/tasks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchTemplates}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setEditing(null)}
              className="flex items-center gap-2 h-9 rounded-xl bg-[#E42D2C] px-4 text-sm font-bold text-white hover:bg-[#c42423] hover:shadow-[0_4px_14px_rgba(228,45,44,0.25)] transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo template
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200 mb-4">
              <Layers className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-[15px] font-semibold text-slate-700">Sin templates</p>
            <p className="text-[13px] text-slate-400 mt-1 max-w-sm">
              Creá un template para acelerar los workflows recurrentes (nuevo bid, onboarding, etc).
            </p>
            <button
              onClick={() => setEditing(null)}
              className="mt-4 inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Crear primer template
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map(t => (
              <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1"
                      style={{
                        backgroundColor: (t.color || "#1e3a8a") + "12",
                        boxShadow:       `0 0 0 1px ${(t.color || "#1e3a8a")}30`,
                      }}
                    >
                      <Layers className="h-4 w-4" style={{ color: t.color || "#1e3a8a" }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[14px] font-bold text-slate-900 truncate">{t.name}</p>
                        {t.is_default && <Star className="h-3 w-3 text-amber-500 shrink-0" />}
                      </div>
                      {t.description && (
                        <p className="text-[11.5px] text-slate-500 truncate">{t.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 my-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" /> {t.subtasks.length} subtasks
                  </span>
                  {t.parent_due_offset_days != null && (
                    <span className="flex items-center gap-1">
                      <CalIcon className="h-3 w-3" /> +{t.parent_due_offset_days}d
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 text-[9px] font-bold uppercase tracking-wide ${PRIORITY_PILL[t.parent_priority]}`}>
                    {t.parent_priority}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditing(t)}
                    className="inline-flex items-center gap-1 h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 hover:border-[#1e3a8a]/30 hover:text-[#1e3a8a] transition-colors"
                  >
                    <Edit3 className="h-3 w-3" /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors ml-auto"
                    title="Borrar"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
