"use client"

/**
 * NewTaskModal — formulario de creación de tarea.
 *
 * Self-contained: usa AssigneesEditor / TagsEditor de inline-editors,
 * y consume "/api/admin/tasks/suggest" para auto-completar prioridad
 * + tags + due_at desde el title con AI.
 *
 * Parent maneja persistencia via onCreate(data). Si tiene optimistic
 * rollback (PR 2), gratis.
 */

import { useState } from "react"
import { Portal } from "@/components/ui/portal"
import { Loader2, X, Sparkles } from "lucide-react"
import { fetchWithViewAs } from "@/lib/api/fetch-with-view-as"
import { createClient } from "@/lib/supabase"
import type { Department } from "@/lib/types/department"
import {
  PRIORITY_OPTIONS, TASK_INPUT_CLS as inputCls,
  type Task, type Priority, type PersonaLite,
} from "./_types"
import { toLocalInputValue } from "./_helpers"
import { AssigneesEditor, TagsEditor } from "./inline-editors"

interface Props {
  personas:      PersonaLite[]
  departments:   Department[]
  onClose:       () => void
  onCreate:      (data: Partial<Task>) => Promise<void>
  creating:      boolean
  prefillDueAt?: string | null
}

export function NewTaskModal({
  personas, departments, onClose, onCreate, creating, prefillDueAt,
}: Props) {
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
      const res = await fetchWithViewAs("/api/admin/tasks/suggest", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ title, description }),
      })
      const j = await res.json()
      if (res.ok) {
        if (j.priority) setPriority(j.priority)
        if (Array.isArray(j.tags) && j.tags.length) {
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
          className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-3.5 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-foreground">Nueva tarea</h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              aria-label="Cerrar"
            >
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
