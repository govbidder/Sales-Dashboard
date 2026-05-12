"use client"

/**
 * Cheat sheet de atajos del kanban — scoped al módulo tasks.
 *
 * Diferente del HelpDialog global (?): este lista atajos específicos
 * del kanban (Q, I, T, J/K, X, etc.). Se abre presionando ? mientras
 * el foco está sobre /admin/tasks. Cierra con Esc o click fuera.
 */

import { Portal } from "@/components/ui/portal"
import { Keyboard, X } from "lucide-react"

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Q"],     label: "Nueva tarea" },
  { keys: ["I"],     label: "Crear tareas desde texto con IA" },
  { keys: ["T"],     label: "Aplicar template" },
  { keys: ["J"],     label: "Siguiente tarea" },
  { keys: ["K"],     label: "Tarea anterior" },
  { keys: ["Enter"], label: "Abrir detalle" },
  { keys: ["E"],     label: "Editar (abrir detalle)" },
  { keys: ["X"],     label: "Marcar completada" },
  { keys: ["⌫"],     label: "Borrar tarea seleccionada" },
  { keys: ["1"],     label: "Vista Board" },
  { keys: ["2"],     label: "Vista Lista" },
  { keys: ["3"],     label: "Vista Calendario" },
  { keys: ["/"],     label: "Buscar" },
  { keys: ["Esc"],   label: "Cerrar" },
  { keys: ["?"],     label: "Mostrar atajos" },
]

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-[#1e3a8a]" />
              <h3 className="text-base font-bold text-foreground">Atajos de teclado</h3>
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            {SHORTCUTS.map(s => (
              <div key={s.label} className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-[13px] text-muted-foreground">{s.label}</span>
                <div className="flex items-center gap-1">
                  {s.keys.map(k => (
                    <kbd
                      key={k}
                      className="inline-flex items-center justify-center min-w-[24px] h-6 rounded-md border border-border bg-muted px-1.5 text-[11px] font-bold text-muted-foreground"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Portal>
  )
}
