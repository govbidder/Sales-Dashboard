"use client"

import { useEffect, useState, useCallback } from "react"
import { Portal } from "@/components/ui/portal"
import { createClient } from "@/lib/supabase"
import {
  X, Loader2, Check, Briefcase, UserPlus, ShieldCheck, FileBarChart,
  Layers, ChevronRight, Flag, Tag as TagIcon, GitBranch, Calendar as CalIcon,
  AlertCircle,
} from "lucide-react"

const ICON_MAP: Record<string, any> = {
  Briefcase, UserPlus, ShieldCheck, FileBarChart, Layers,
}

interface Template {
  id:                    string
  name:                  string
  description:           string | null
  icon:                  string | null
  color:                 string | null
  parent_title:          string
  parent_description:    string | null
  parent_priority:       "baja" | "media" | "alta" | "urgente"
  parent_tags:           string[]
  parent_due_offset_days: number | null
  subtasks:              Array<{
    title:           string
    priority?:       "baja" | "media" | "alta" | "urgente"
    due_offset_days?: number | null
    tags?:           string[]
  }>
  is_default:            boolean
}

interface Props {
  onClose:    () => void
  onApplied:  (createdTask: any) => void
}

const PRIORITY_PILL: Record<string, string> = {
  baja:    "border-zinc-300  bg-zinc-50    text-zinc-700",
  media:   "border-amber-300 bg-amber-50   text-amber-800",
  alta:    "border-orange-300 bg-orange-50 text-orange-800",
  urgente: "border-red-300   bg-red-50     text-[#E42D2C]",
}

export function TemplatesModal({ onClose, onApplied }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<Template | null>(null)
  const [titleOverride, setTitleOverride] = useState("")
  const [applying,  setApplying]  = useState(false)
  const [err,       setErr]       = useState<string | null>(null)

  const getSession = async () => {
    const { data: { session } } = await createClient().auth.getSession()
    return session
  }

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch("/api/admin/task-templates", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const j = await res.json()
        setTemplates(j.templates ?? [])
      } else {
        const j = await res.json().catch(() => ({}))
        setErr(j.error || "No pude cargar los templates.")
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const apply = async () => {
    if (!selected) return
    setApplying(true)
    setErr(null)
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch("/api/admin/task-templates", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ templateId: selected.id, title: titleOverride || undefined }),
      })
      const j = await res.json()
      if (res.ok && j.task) {
        onApplied(j.task)
        onClose()
      } else {
        setErr(j.error || "No pude aplicar el template.")
      }
    } finally { setApplying(false) }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e3a8a]/[0.06] ring-1 ring-[#1e3a8a]/15">
                <Layers className="h-4 w-4 text-[#1e3a8a]" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">
                  {selected ? selected.name : "Templates de tareas"}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {selected
                    ? `Crea ${selected.subtasks.length + 1} tareas (1 principal + ${selected.subtasks.length} subtareas).`
                    : "Workflows pre-armados para arrancar rápido."}
                </p>
              </div>
            </div>
            <button onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-[#E42D2C]/40" />
              </div>
            ) : !selected ? (
              templates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-8 text-center">
                  <Layers className="h-5 w-5 text-slate-400 mx-auto mb-2" />
                  <p className="text-[13px] text-slate-500">No hay templates todavía.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Aplicá la migración <code className="text-[10.5px] bg-slate-100 px-1 rounded">20250505000001_task_templates.sql</code> en Supabase para precargar los defaults.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map(t => {
                    const Icon = (t.icon && ICON_MAP[t.icon]) || Briefcase
                    return (
                      <button
                        key={t.id}
                        onClick={() => { setSelected(t); setTitleOverride(t.parent_title) }}
                        className="group w-full flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-[#1e3a8a]/30 hover:shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1"
                          style={{
                            backgroundColor: (t.color || "#1e3a8a") + "12",
                            boxShadow:       `0 0 0 1px ${(t.color || "#1e3a8a")}30`,
                          }}
                        >
                          <Icon className="h-4 w-4" style={{ color: t.color || "#1e3a8a" }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13.5px] font-bold text-slate-900">{t.name}</p>
                            {t.is_default && (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                Default
                              </span>
                            )}
                          </div>
                          {t.description && (
                            <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">{t.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              {t.subtasks.length} subtareas
                            </span>
                            {t.parent_due_offset_days != null && (
                              <span className="flex items-center gap-1">
                                <CalIcon className="h-3 w-3" />
                                {t.parent_due_offset_days}d
                              </span>
                            )}
                            {t.parent_tags.length > 0 && (
                              <span className="flex items-center gap-1">
                                <TagIcon className="h-3 w-3" />
                                {t.parent_tags.slice(0, 2).join(", ")}
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#1e3a8a] group-hover:translate-x-0.5 transition-all mt-1.5" />
                      </button>
                    )
                  })}
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/70">
                    Título de la tarea principal
                  </label>
                  <input
                    type="text"
                    value={titleOverride}
                    onChange={e => setTitleOverride(e.target.value)}
                    autoFocus
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:border-[#1e3a8a]/40 focus:ring-2 focus:ring-[#1e3a8a]/10 transition-all"
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Subtareas que se crean
                    </p>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {selected.subtasks.length}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {selected.subtasks.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500 shrink-0">
                          {i + 1}
                        </span>
                        <span className="flex-1 text-[12.5px] text-slate-700 truncate">{s.title}</span>
                        {s.priority && (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${PRIORITY_PILL[s.priority]}`}>
                            <Flag className="h-2 w-2" />
                            {s.priority}
                          </span>
                        )}
                        {s.due_offset_days != null && (
                          <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                            +{s.due_offset_days}d
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {err && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{err}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {selected && (
            <div className="border-t border-slate-200 px-6 py-3 flex items-center justify-between gap-3">
              <button
                onClick={() => { setSelected(null); setErr(null) }}
                className="text-[12px] text-slate-500 hover:text-slate-900 transition-colors px-2 py-1.5"
              >
                ← Volver
              </button>
              <button
                onClick={apply}
                disabled={applying || !titleOverride.trim()}
                className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] hover:shadow-[0_4px_14px_rgba(228,45,44,0.25)] transition-all disabled:opacity-40"
              >
                {applying
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Aplicando…</>
                  : <><Check className="h-3.5 w-3.5" /> Aplicar template</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}
