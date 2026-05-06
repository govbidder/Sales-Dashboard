"use client"

import { useState } from "react"
import { Portal } from "@/components/ui/portal"
import { createClient } from "@/lib/supabase"
import {
  Loader2, X, Sparkles, AlertCircle, Flag, Calendar as CalIcon,
  Tag as TagIcon, User, ArrowLeft, Check, Trash2,
} from "lucide-react"

interface ExtractedTask {
  title:       string
  description: string | null
  priority:    "baja" | "media" | "alta" | "urgente"
  due_at:      string | null
  tags:        string[]
  assignees:   string[]
  reasoning:   string
}

interface Props {
  onClose:    () => void
  /** Called with the freshly created Task[] returned by the server. */
  onApplied:  (tasks: any[]) => void
}

const PRIORITY_PILL: Record<string, string> = {
  baja:    "border-zinc-300  bg-zinc-50    text-zinc-700",
  media:   "border-amber-300 bg-amber-50   text-amber-800",
  alta:    "border-orange-300 bg-orange-50 text-orange-800",
  urgente: "border-red-300   bg-red-50     text-[#E42D2C]",
}

function fmtDateTime(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

export function AiExtractModal({ onClose, onApplied }: Props) {
  const [phase,    setPhase]    = useState<"input" | "preview">("input")
  const [text,     setText]     = useState("")
  const [loading,  setLoading]  = useState(false)
  const [err,      setErr]      = useState<string | null>(null)
  const [proposal, setProposal] = useState<ExtractedTask[]>([])
  const [keep,     setKeep]     = useState<Set<number>>(new Set())
  const [persisting, setPersisting] = useState(false)

  const getSession = async () => {
    const { data: { session } } = await createClient().auth.getSession()
    return session
  }

  const runExtract = async () => {
    if (!text.trim()) return
    setLoading(true)
    setErr(null)
    try {
      const session = await getSession()
      if (!session) { setErr("Sesión expirada."); return }
      const res = await fetch("/api/admin/tasks/extract", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ text, persist: false }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error || "Error procesando el texto.")
        return
      }
      const tasks = (json.tasks ?? []) as ExtractedTask[]
      if (tasks.length === 0) {
        setErr("No detecté tareas accionables en este texto.")
        return
      }
      setProposal(tasks)
      setKeep(new Set(tasks.map((_, i) => i)))   // pre-select all
      setPhase("preview")
    } catch (e: any) {
      setErr(e?.message ?? "Error inesperado.")
    } finally {
      setLoading(false)
    }
  }

  const toggle = (i: number) => {
    setKeep(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const editField = <K extends keyof ExtractedTask>(idx: number, field: K, value: ExtractedTask[K]) => {
    setProposal(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t))
  }

  const apply = async () => {
    const tasks = proposal.filter((_, i) => keep.has(i))
    if (!tasks.length) return
    setPersisting(true)
    setErr(null)
    try {
      const session = await getSession()
      if (!session) { setErr("Sesión expirada."); return }
      const res = await fetch("/api/admin/tasks/extract", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        // Re-extract from the same text but with persist=true. Edge-case:
        // the user could have edited fields. Easier: insert directly via /api/admin/tasks
        // batch using the local proposal.
        body: JSON.stringify({ text: "_skip_", persist: false }),
      }).catch(() => null)

      // Actually we want to insert the (possibly edited) proposal directly,
      // not re-run the model. Use the batch insert via /api/admin/tasks.
      const created: any[] = []
      for (const t of tasks) {
        const r = await fetch("/api/admin/tasks", {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}` },
          body:    JSON.stringify({
            title:       t.title,
            description: t.description,
            priority:    t.priority,
            due_at:      t.due_at,
            tags:        t.tags,
            assignees:   t.assignees,
          }),
        })
        const j = await r.json()
        if (r.ok && j.task) created.push(j.task)
      }

      onApplied(created)
      onClose()
    } catch (e: any) {
      setErr(e?.message ?? "Error guardando las tareas.")
    } finally {
      setPersisting(false)
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#E42D2C]/10 to-[#1e3a8a]/10 ring-1 ring-[#1e3a8a]/15">
                <Sparkles className="h-4 w-4 text-[#1e3a8a]" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">Crear tareas desde texto</h3>
                <p className="text-[11px] text-slate-500">
                  {phase === "input"
                    ? "Pegá un email, brief o nota — la IA detecta las tareas."
                    : `${keep.size} de ${proposal.length} tareas seleccionadas`}
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

            {phase === "input" && (
              <>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={`Ej:\n\n"Hola Santo, necesito que me mandes la capability statement del cliente XYZ urgente, antes del viernes. Y avisame cuando tengas la propuesta del bid 2024-DOD-007 lista. Después coordinemos llamada con el equipo de Maria para revisar la submission del DOE."`}
                  rows={12}
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a]/40 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/10 resize-none"
                />

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Sparkles className="h-3 w-3" />
                  <span>{text.length}/8000 chars</span>
                  <span className="ml-auto">
                    Detecta título, prioridad, fecha, tags y asignados.
                  </span>
                </div>

                {err && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{err}</span>
                  </div>
                )}
              </>
            )}

            {phase === "preview" && (
              <div className="space-y-2">
                {proposal.map((t, idx) => {
                  const isKept = keep.has(idx)
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border p-3 transition-all ${
                        isKept
                          ? "border-[#1e3a8a]/25 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                          : "border-slate-200 bg-slate-50/50 opacity-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggle(idx)}
                          className={`shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${
                            isKept
                              ? "border-[#1e3a8a] bg-[#1e3a8a] text-white"
                              : "border-slate-300 hover:border-slate-500"
                          }`}
                        >
                          {isKept && <Check className="h-3 w-3" />}
                        </button>

                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Title (editable) */}
                          <input
                            type="text"
                            value={t.title}
                            onChange={e => editField(idx, "title", e.target.value)}
                            disabled={!isKept}
                            className="w-full bg-transparent text-[13px] font-bold text-slate-900 outline-none disabled:opacity-60"
                          />

                          {/* Reasoning (italic) */}
                          {t.reasoning && (
                            <p className="text-[10.5px] italic text-slate-400 leading-snug">
                              ↳ {t.reasoning}
                            </p>
                          )}

                          {/* Description (editable) */}
                          {t.description && (
                            <textarea
                              value={t.description}
                              onChange={e => editField(idx, "description", e.target.value || null)}
                              disabled={!isKept}
                              rows={2}
                              className="w-full bg-slate-50/50 rounded-lg border border-slate-200 px-2 py-1.5 text-[11.5px] text-slate-600 outline-none focus:border-[#1e3a8a]/40 focus:bg-white resize-none disabled:opacity-60"
                            />
                          )}

                          {/* Pills row */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <select
                              value={t.priority}
                              onChange={e => editField(idx, "priority", e.target.value as any)}
                              disabled={!isKept}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide cursor-pointer ${PRIORITY_PILL[t.priority]}`}
                            >
                              <option value="baja">Baja</option>
                              <option value="media">Media</option>
                              <option value="alta">Alta</option>
                              <option value="urgente">Urgente</option>
                            </select>

                            {t.due_at && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-[#1e3a8a]/20 bg-[#1e3a8a]/[0.05] px-2 py-0.5 text-[10px] font-bold text-[#1e3a8a]">
                                <CalIcon className="h-2.5 w-2.5" />
                                {fmtDateTime(t.due_at)}
                              </span>
                            )}

                            {t.tags.map(tag => (
                              <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                                <TagIcon className="h-2.5 w-2.5 text-slate-400" />
                                {tag}
                              </span>
                            ))}

                            {t.assignees.map(a => (
                              <span key={a} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                                <User className="h-2.5 w-2.5 text-slate-400" />
                                {a}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

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
          <div className="border-t border-slate-200 px-6 py-3 flex items-center justify-between gap-3">
            {phase === "input" ? (
              <>
                <button
                  onClick={onClose}
                  className="text-[12px] text-slate-500 hover:text-slate-900 transition-colors px-2 py-1.5"
                >
                  Cancelar
                </button>
                <button
                  onClick={runExtract}
                  disabled={!text.trim() || loading}
                  className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] hover:shadow-[0_4px_14px_rgba(228,45,44,0.25)] transition-all disabled:opacity-40"
                >
                  {loading
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Procesando…</>
                    : <><Sparkles className="h-3.5 w-3.5" /> Detectar tareas</>}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setPhase("input"); setProposal([]); setKeep(new Set()) }}
                  className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-900 transition-colors px-2 py-1.5"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Volver al texto
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setKeep(new Set())}
                    disabled={persisting || keep.size === 0}
                    className="inline-flex items-center gap-1 h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 hover:border-slate-300 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" /> Quitar todas
                  </button>
                  <button
                    onClick={apply}
                    disabled={keep.size === 0 || persisting}
                    className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] hover:shadow-[0_4px_14px_rgba(228,45,44,0.25)] transition-all disabled:opacity-40"
                  >
                    {persisting
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creando…</>
                      : <><Check className="h-3.5 w-3.5" /> Crear {keep.size} {keep.size === 1 ? "tarea" : "tareas"}</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Portal>
  )
}
