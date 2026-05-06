"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { Portal } from "@/components/ui/portal"
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from "@dnd-kit/core"
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Loader2, Plus, X, Edit3, Trash2, Copy, ExternalLink, Check, GripVertical,
  AlertCircle, FormInput, Power, ChevronRight, RefreshCw, FileText,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType = "text" | "longtext" | "email" | "phone" | "select" | "date"

interface FormField {
  key:         string
  label:       string
  type:        FieldType
  required?:   boolean
  placeholder?: string
  options?:    string[]
}

interface TaskForm {
  id:                 string
  slug:               string
  title:              string
  description:        string | null
  fields:             FormField[]
  default_priority:   "baja" | "media" | "alta" | "urgente"
  default_tags:       string[]
  default_assignees:  string[]
  is_active:          boolean
  submit_count:       number
  created_by:         string | null
  created_at:         string
  updated_at:         string
}

interface Submission {
  id:               string
  task_id:          string | null
  submitter_email:  string | null
  submitter_name:   string | null
  payload:          Record<string, any>
  created_at:       string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: "text",     label: "Texto corto",  icon: "Aa" },
  { value: "longtext", label: "Texto largo",  icon: "¶" },
  { value: "email",    label: "Email",        icon: "@" },
  { value: "phone",    label: "Teléfono",     icon: "☎" },
  { value: "select",   label: "Selector",     icon: "▼" },
  { value: "date",     label: "Fecha",        icon: "📅" },
]

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1)  return "ahora"
  if (min < 60) return `hace ${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24)  return `hace ${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7)  return `hace ${day}d`
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

function slugify(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // strip accents
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
}

// ─── Sortable Field Row (for the editor) ─────────────────────────────────────

function SortableFieldRow({
  field, idx, onChange, onDelete,
}: {
  field:    FormField
  idx:      number
  onChange: (next: FormField) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.key,
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
      className="rounded-xl border border-slate-200 bg-white p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors"
          aria-label="Arrastrar"
          type="button"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 shrink-0">
          {idx + 1}
        </span>
        <input
          type="text"
          value={field.label}
          onChange={e => onChange({ ...field, label: e.target.value })}
          placeholder="Label visible al usuario"
          className="flex-1 bg-transparent text-[13px] font-bold text-slate-900 outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={onDelete}
          className="text-slate-300 hover:text-red-600 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-7">
        <select
          value={field.type}
          onChange={e => onChange({ ...field, type: e.target.value as FieldType })}
          className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none cursor-pointer hover:border-slate-300"
        >
          {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <input
          type="text"
          value={field.key}
          onChange={e => onChange({ ...field, key: e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase() })}
          placeholder="campo_id"
          className="h-7 w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] font-mono text-slate-600 outline-none focus:border-[#1e3a8a]/40 focus:bg-white"
          title="Identifier interno (snake_case)"
        />

        <input
          type="text"
          value={field.placeholder ?? ""}
          onChange={e => onChange({ ...field, placeholder: e.target.value })}
          placeholder="Placeholder (opcional)"
          className="flex-1 min-w-[100px] h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-[#1e3a8a]/40"
        />

        <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={e => onChange({ ...field, required: e.target.checked })}
            className="h-3 w-3 accent-[#E42D2C]"
          />
          requerido
        </label>
      </div>
    </div>
  )
}

// ─── Form Editor Drawer ──────────────────────────────────────────────────────

function FormEditor({
  form, onClose, onSaved,
}: {
  form:    TaskForm | null   // null = create new
  onClose: () => void
  onSaved: (saved: TaskForm) => void
}) {
  const isNew = !form
  const [slug,             setSlug]             = useState(form?.slug ?? "")
  const [title,            setTitle]            = useState(form?.title ?? "")
  const [description,      setDescription]      = useState(form?.description ?? "")
  const [fields,           setFields]           = useState<FormField[]>(form?.fields ?? [])
  const [defaultPriority,  setDefaultPriority]  = useState(form?.default_priority ?? "media")
  const [defaultTagsInput, setDefaultTagsInput] = useState((form?.default_tags ?? []).join(", "))
  const [defaultAssignees, setDefaultAssignees] = useState((form?.default_assignees ?? []).join(", "))
  const [isActive,         setIsActive]         = useState(form?.is_active ?? true)
  const [saving,           setSaving]           = useState(false)
  const [err,              setErr]              = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = fields.map(f => f.key)
    const oldIdx = ids.indexOf(String(active.id))
    const newIdx = ids.indexOf(String(over.id))
    if (oldIdx === -1 || newIdx === -1) return
    setFields(arrayMove(fields, oldIdx, newIdx))
  }

  const updateField = (idx: number, next: FormField) => {
    setFields(prev => prev.map((f, i) => i === idx ? next : f))
  }
  const addField = () => {
    const usedKeys = new Set(fields.map(f => f.key))
    let n = fields.length + 1
    let key = `campo_${n}`
    while (usedKeys.has(key)) { n++; key = `campo_${n}` }
    setFields([...fields, { key, label: "Nuevo campo", type: "text", required: false }])
  }

  const handleTitleChange = (v: string) => {
    setTitle(v)
    if (isNew && !slug) setSlug(slugify(v))
  }

  const save = async () => {
    if (!title.trim()) { setErr("Falta el título"); return }
    if (!slug.trim()) { setErr("Falta el slug"); return }
    if (!/^[a-z0-9-]+$/.test(slug)) { setErr("Slug solo puede tener letras minúsculas, números y guiones"); return }
    if (fields.length === 0) { setErr("Agregá al menos 1 campo"); return }

    // Check unique keys
    const keys = fields.map(f => f.key)
    if (new Set(keys).size !== keys.length) {
      setErr("Hay campos con el mismo identifier — cada uno debe ser único")
      return
    }

    setSaving(true)
    setErr(null)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) return
      const url = "/api/admin/forms"
      const payload = {
        slug,
        title,
        description: description || null,
        fields,
        default_priority:  defaultPriority,
        default_tags:      defaultTagsInput.split(",").map(s => s.trim()).filter(Boolean),
        default_assignees: defaultAssignees.split(",").map(s => s.trim()).filter(Boolean),
        is_active: isActive,
      }

      const res = isNew
        ? await fetch(url, {
            method:  "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body:    JSON.stringify(payload),
          })
        : await fetch(url, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body:    JSON.stringify({ id: form!.id, ...payload }),
          })
      const j = await res.json()
      if (!res.ok) { setErr(j.error || "No pude guardar"); return }
      onSaved(j.form)
    } finally { setSaving(false) }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-[110] flex w-full max-w-[640px] flex-col border-l border-slate-200 shadow-2xl bg-white">

        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-slate-900">
              {isNew ? "Nuevo form" : "Editar form"}
            </h3>
            <p className="text-[12px] text-slate-400 mt-0.5">
              {isNew ? "Configurá los campos y publicá." : `Slug: /forms/${slug}`}
            </p>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Basic */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Título *</p>
              <input
                type="text"
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="Brief inicial de proyecto"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:border-[#1e3a8a]/40 focus:ring-2 focus:ring-[#1e3a8a]/10"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Slug (URL) *</p>
              <div className="flex items-center gap-1">
                <span className="text-[12px] text-slate-400">/forms/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="brief-inicial"
                  className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-mono text-slate-900 outline-none focus:border-[#1e3a8a]/40 focus:ring-2 focus:ring-[#1e3a8a]/10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Subtítulo / instrucciones</p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Contanos qué necesitás y nos ponemos en contacto en 24h."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-[#1e3a8a]/40 focus:ring-2 focus:ring-[#1e3a8a]/10 resize-none"
            />
          </div>

          {/* Fields */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">
                Campos del form ({fields.length})
              </p>
              <button
                type="button"
                onClick={addField}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E42D2C] hover:text-[#c42423] transition-colors"
              >
                <Plus className="h-3 w-3" /> Agregar campo
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-8 text-center">
                <FormInput className="h-5 w-5 text-slate-400 mx-auto mb-2" />
                <p className="text-[12.5px] text-slate-500">Todavía no hay campos. Agregá el primero.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={fields.map(f => f.key)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {fields.map((f, i) => (
                      <SortableFieldRow
                        key={f.key}
                        field={f}
                        idx={i}
                        onChange={next => updateField(i, next)}
                        onDelete={() => setFields(prev => prev.filter((_, j) => j !== i))}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Defaults para la tarea creada */}
          <div className="space-y-2 pt-3 border-t border-slate-200">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">
              Valores por defecto en la tarea
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Prioridad</p>
                <select
                  value={defaultPriority}
                  onChange={e => setDefaultPriority(e.target.value as any)}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none cursor-pointer hover:border-slate-300 capitalize"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Estado activo</p>
                <button
                  type="button"
                  onClick={() => setIsActive(v => !v)}
                  className={`h-9 w-full rounded-xl border px-3 text-[12px] font-bold transition-colors flex items-center justify-center gap-2 ${
                    isActive
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  {isActive ? "Activo (público)" : "Inactivo (oculto)"}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Tags (separados por coma)</p>
              <input
                type="text"
                value={defaultTagsInput}
                onChange={e => setDefaultTagsInput(e.target.value)}
                placeholder="form, lead, brief"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:border-[#1e3a8a]/40 focus:ring-2 focus:ring-[#1e3a8a]/10"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Asignados (emails separados por coma)</p>
              <input
                type="text"
                value={defaultAssignees}
                onChange={e => setDefaultAssignees(e.target.value)}
                placeholder="santo@govbidder.com"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:border-[#1e3a8a]/40 focus:ring-2 focus:ring-[#1e3a8a]/10"
              />
            </div>
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
              : <><Check className="h-3.5 w-3.5" /> {isNew ? "Crear form" : "Guardar cambios"}</>}
          </button>
        </div>
      </div>
    </Portal>
  )
}

// ─── Submissions panel ───────────────────────────────────────────────────────

function SubmissionsPanel({
  form, onClose,
}: {
  form:    TaskForm
  onClose: () => void
}) {
  const [items,   setItems]   = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        if (!session) return
        const res = await fetch(`/api/admin/forms/${form.id}/submissions`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) setItems((await res.json()).submissions ?? [])
      } finally { setLoading(false) }
    }
    load()
  }, [form.id])

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-[110] flex w-full max-w-[640px] flex-col border-l border-slate-200 shadow-2xl bg-white">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{form.title}</h3>
            <p className="text-[12px] text-slate-400 mt-0.5">
              {items.length} submission{items.length === 1 ? "" : "s"}
            </p>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-12 text-center">
              <FileText className="h-5 w-5 text-slate-400 mx-auto mb-2" />
              <p className="text-[13px] text-slate-500">Todavía nadie completó este form.</p>
              <p className="text-[11px] text-slate-400 mt-1">Compartí el link público para empezar a recibir.</p>
            </div>
          ) : (
            items.map(s => (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-900">
                      {s.submitter_name || s.submitter_email || "Anónimo"}
                    </p>
                    {s.submitter_email && s.submitter_name && (
                      <p className="text-[11px] text-slate-500">{s.submitter_email}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{fmtRelative(s.created_at)}</span>
                </div>
                <div className="mt-2 rounded-lg bg-slate-50 p-2.5 text-[11.5px] text-slate-700 space-y-0.5">
                  {Object.entries(s.payload).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="font-bold text-slate-500 min-w-[100px]">{k}:</span>
                      <span className="text-slate-700">{String(v)}</span>
                    </div>
                  ))}
                </div>
                {s.task_id && (
                  <a href="/admin/tasks" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#1e3a8a] hover:text-[#E42D2C]">
                    Ver tarea creada <ChevronRight className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Portal>
  )
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function FormsAdminView() {
  const [forms,         setForms]         = useState<TaskForm[]>([])
  const [loading,       setLoading]       = useState(true)
  const [editing,       setEditing]       = useState<TaskForm | null | undefined>(undefined) // undefined = closed
  const [submissionsOf, setSubmissionsOf] = useState<TaskForm | null>(null)
  const [copiedId,      setCopiedId]      = useState<string | null>(null)

  const fetchForms = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) return
      const res = await fetch("/api/admin/forms", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) setForms((await res.json()).forms ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchForms() }, [fetchForms])

  const handleSaved = (saved: TaskForm) => {
    setForms(prev => {
      const idx = prev.findIndex(f => f.id === saved.id)
      if (idx === -1) return [saved, ...prev]
      return prev.map(f => f.id === saved.id ? saved : f)
    })
    setEditing(undefined)
  }

  const handleDelete = async (f: TaskForm) => {
    if (!confirm(`¿Borrar el form "${f.title}"? Esto también borra todos sus submissions.`)) return
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) return
    const res = await fetch("/api/admin/forms", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id: f.id }),
    })
    if (res.ok) setForms(prev => prev.filter(x => x.id !== f.id))
  }

  const handleToggleActive = async (f: TaskForm) => {
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) return
    const next = !f.is_active
    setForms(prev => prev.map(x => x.id === f.id ? { ...x, is_active: next } : x))
    await fetch("/api/admin/forms", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id: f.id, is_active: next }),
    })
  }

  const copyLink = async (f: TaskForm) => {
    const url = `${window.location.origin}/forms/${f.slug}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(f.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch { /* ignore */ }
  }

  return (
    <>
      {editing !== undefined && (
        <FormEditor
          form={editing}
          onClose={() => setEditing(undefined)}
          onSaved={handleSaved}
        />
      )}
      {submissionsOf && (
        <SubmissionsPanel form={submissionsOf} onClose={() => setSubmissionsOf(null)} />
      )}

      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a8a] tracking-tight">Forms públicos</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {forms.length} {forms.length === 1 ? "form" : "forms"} · cada submit crea una tarea automáticamente
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchForms}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all disabled:opacity-40"
              title="Refrescar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setEditing(null)}
              className="flex items-center gap-2 h-9 rounded-xl bg-[#E42D2C] px-4 text-sm font-bold text-white hover:bg-[#c42423] hover:shadow-[0_4px_14px_rgba(228,45,44,0.25)] transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo form
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
          </div>
        ) : forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200 mb-4">
              <FormInput className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-[15px] font-semibold text-slate-700">Todavía no hay forms</p>
            <p className="text-[13px] text-slate-400 mt-1 max-w-sm">
              Creá un form público — la URL la podés mandar a clientes o postear en LinkedIn.
              Cada submit crea una tarea automáticamente en el board.
            </p>
            <button
              onClick={() => setEditing(null)}
              className="mt-4 inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Crear primer form
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {forms.map(f => {
              const url = typeof window !== "undefined" ? `${window.location.origin}/forms/${f.slug}` : `/forms/${f.slug}`
              return (
                <div key={f.id} className={`relative overflow-hidden rounded-2xl border bg-white p-4 transition-all hover:shadow-[0_4px_14px_rgba(15,23,42,0.06)] ${
                  f.is_active ? "border-slate-200" : "border-slate-200 opacity-60"
                }`}>
                  {/* Active badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${
                        f.is_active
                          ? "bg-[#1e3a8a]/[0.08] ring-[#1e3a8a]/15"
                          : "bg-slate-100 ring-slate-200"
                      }`}>
                        <FormInput className={`h-4 w-4 ${f.is_active ? "text-[#1e3a8a]" : "text-slate-400"}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-slate-900 truncate">{f.title}</p>
                        <p className="text-[11px] text-slate-500 font-mono truncate">/forms/{f.slug}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleActive(f)}
                      className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                        f.is_active
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                      title={f.is_active ? "Desactivar" : "Activar"}
                    >
                      <Power className="h-3 w-3" />
                    </button>
                  </div>

                  {f.description && (
                    <p className="text-[12px] text-slate-500 mb-3 line-clamp-2 leading-snug">{f.description}</p>
                  )}

                  <div className="flex items-center gap-3 mb-3 text-[11px] text-slate-400">
                    <span>{f.fields.length} campos</span>
                    <span>·</span>
                    <span className="font-bold text-[#1e3a8a]">{f.submit_count} submissions</span>
                    <span>·</span>
                    <span className="capitalize">prioridad {f.default_priority}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => copyLink(f)}
                      className="inline-flex items-center gap-1 h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 hover:border-[#1e3a8a]/30 hover:text-[#1e3a8a] transition-colors"
                    >
                      {copiedId === f.id
                        ? <><Check className="h-3 w-3" /> Copiado</>
                        : <><Copy className="h-3 w-3" /> Link</>}
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 hover:border-[#1e3a8a]/30 hover:text-[#1e3a8a] transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" /> Ver
                    </a>
                    <button
                      onClick={() => setSubmissionsOf(f)}
                      className="inline-flex items-center gap-1 h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 hover:border-[#1e3a8a]/30 hover:text-[#1e3a8a] transition-colors"
                    >
                      <FileText className="h-3 w-3" /> Submissions
                    </button>
                    <button
                      onClick={() => setEditing(f)}
                      className="inline-flex items-center gap-1 h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 hover:border-[#1e3a8a]/30 hover:text-[#1e3a8a] transition-colors ml-auto"
                    >
                      <Edit3 className="h-3 w-3" /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(f)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Borrar"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
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
