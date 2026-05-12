"use client"

/**
 * Inline editors compartidos del módulo tasks: tags + assignees.
 *
 * Usados desde NewTaskModal (creación) y DetailDrawer (edición). Antes
 * vivían en tasks-view.tsx — extraídos para que el modal y el drawer
 * sean importables sin duplicar.
 *
 * Pattern: input para draft + lista de chips removibles. Enter / blur
 * agregan; click X remueve. Sin comma-separated (peor UX para inputs
 * con espacios o emails).
 */

import { useState } from "react"
import { X, Tag as TagIcon } from "lucide-react"
import { initials } from "./_helpers"

interface Props {
  value:    string[]
  onChange: (next: string[]) => void
}

// ─── Tags ────────────────────────────────────────────────────────────────────

export function TagsEditor({ value, onChange }: Props) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const v = draft.trim()
    if (!v || value.includes(v)) { setDraft(""); return }
    onChange([...value, v])
    setDraft("")
  }
  const remove = (t: string) => onChange(value.filter(x => x !== t))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[24px]">
        {value.map(t => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            <TagIcon className="h-2.5 w-2.5 text-muted-foreground" />
            {t}
            <button
              type="button"
              onClick={() => remove(t)}
              className="text-muted-foreground hover:text-red-600 transition-colors ml-0.5"
              aria-label={`Quitar tag ${t}`}
            >
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
        className="h-7 w-full rounded-lg border border-border bg-card px-2.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-[#1e3a8a]/40 focus:outline-none"
      />
    </div>
  )
}

// ─── Assignees ───────────────────────────────────────────────────────────────

export function AssigneesEditor({ value, onChange }: Props) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const v = draft.trim()
    if (!v || value.includes(v)) { setDraft(""); return }
    onChange([...value, v])
    setDraft("")
  }
  const remove = (a: string) => onChange(value.filter(x => x !== a))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[24px]">
        {value.map(a => (
          <span key={a} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted pl-1 pr-2 py-0.5 text-[11px] text-muted-foreground">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#E42D2C] to-[#1e3a8a] text-[8px] font-bold text-white">
              {initials(a)}
            </span>
            {a}
            <button
              type="button"
              onClick={() => remove(a)}
              className="text-muted-foreground hover:text-red-600 transition-colors"
              aria-label={`Quitar asignado ${a}`}
            >
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
        className="h-7 w-full rounded-lg border border-border bg-card px-2.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-[#1e3a8a]/40 focus:outline-none"
      />
    </div>
  )
}
