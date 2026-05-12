"use client"

/**
 * Help dialog — cheat sheet de keyboard shortcuts.
 *
 * Se abre con `?` (sin modificadores, fuera de inputs). También exporta
 * `<HelpTrigger />` para abrirlo desde botones del topbar / sidebar si
 * en algún momento queremos un entry point visible.
 *
 * Filosofía Linear: shortcuts existen, hay que enseñarlos. Si no los
 * documentamos, son features fantasma.
 */

import { useEffect, useState } from "react"
import { Portal } from "@/components/ui/portal"
import { X, Keyboard, Command, Sparkles, Plus, ArrowRight, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

interface Shortcut {
  keys:  string[]   // ej ["⌘", "K"] · ["G", "I"]
  label: string
  hint?: string
}

interface Group {
  title:    string
  icon:     any
  shortcuts: Shortcut[]
}

const GROUPS: Group[] = [
  {
    title: "Navegación rápida",
    icon:  Command,
    shortcuts: [
      { keys: ["⌘", "K"], label: "Abrir búsqueda / palette",          hint: "Cmd+K en Mac, Ctrl+K en otros" },
      { keys: ["G", "I"], label: "Ir a Inicio" },
      { keys: ["G", "T"], label: "Ir a Tareas" },
      { keys: ["G", "A"], label: "Ir a Personas Agendadas" },
      { keys: ["G", "M"], label: "Ir a Métricas" },
      { keys: ["G", "E"], label: "Ir a Equipo" },
      { keys: ["G", "O"], label: "Ir a Centro Operativo" },
      { keys: ["G", "R"], label: "Ir a Cargar Reporte" },
    ],
  },
  {
    title: "Crear rápido",
    icon:  Plus,
    shortcuts: [
      { keys: ["N"], label: "Nueva tarea" },
      { keys: ["P"], label: "Nueva persona agendada" },
    ],
  },
  {
    title: "Módulos especiales",
    icon:  Sparkles,
    shortcuts: [
      { keys: ["⌘", "⇧", "C"], label: "Abrir CRM (portal)" },
    ],
  },
  {
    title: "Ayuda",
    icon:  Keyboard,
    shortcuts: [
      { keys: ["?"],   label: "Mostrar este panel" },
      { keys: ["Esc"], label: "Cerrar modales y popovers" },
    ],
  },
]

// ─── Hook que escucha `?` ────────────────────────────────────────────────────
// Solo cuando el foco NO está en un input (para que escribir `?` en un campo
// no abra el dialog). Esto es la regla Linear/GitHub.

export function HelpDialogProvider() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function isEditable(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName.toLowerCase()
      return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable
    }

    function onKey(e: KeyboardEvent) {
      if (open && e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
        return
      }
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditable(e.target)) {
        e.preventDefault()
        setOpen(v => !v)
      }
    }

    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  if (!open) return null
  return <HelpDialog onClose={() => setOpen(false)} />
}

// ─── Dialog UI ────────────────────────────────────────────────────────────────

function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[140] bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[141] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_80px_rgba(15,23,42,0.30)] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e3a8a]/15 ring-1 ring-[#1e3a8a]/25">
                <Keyboard className="h-4 w-4 text-[#1e3a8a]" />
              </span>
              <div>
                <h2 className="text-base font-bold text-foreground leading-none">
                  Atajos de teclado
                </h2>
                <p className="text-[11.5px] text-muted-foreground mt-1">
                  Presioná <KbdInline>?</KbdInline> en cualquier momento para volver acá
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Groups */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {GROUPS.map(group => {
              const Icon = group.icon
              return (
                <div key={group.title}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-3.5 w-3.5 text-[#1e3a8a]" />
                    <h3 className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">
                      {group.title}
                    </h3>
                    <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                    <div className="divide-y divide-border">
                      {group.shortcuts.map((s, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-foreground">{s.label}</p>
                            {s.hint && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">{s.hint}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {s.keys.map((k, j) => (
                              <KbdInline key={j}>{k}</KbdInline>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}

            <div className="rounded-xl border border-[#1e3a8a]/20 bg-[#1e3a8a]/[0.04] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <Eye className="h-4 w-4 text-[#1e3a8a] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[12.5px] font-semibold text-foreground">Tip</p>
                  <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">
                    Los atajos de "Ir a X" funcionan en secuencia: presioná <KbdInline>G</KbdInline>{" "}
                    y dentro de 1 segundo la letra del destino. No funcionan mientras escribís en
                    un input.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Más atajos llegando — esta lista crece con cada PR.</span>
            <span className="inline-flex items-center gap-1">
              Cerrar con <KbdInline>Esc</KbdInline>
            </span>
          </div>
        </div>
      </div>
    </Portal>
  )
}

// ─── Inline kbd badge ─────────────────────────────────────────────────────────

function KbdInline({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md",
        "border border-border bg-background px-1.5",
        "text-[11px] font-mono font-semibold text-muted-foreground",
        "shadow-[0_1px_0_var(--border)]",
      )}
    >
      {children}
    </kbd>
  )
}
