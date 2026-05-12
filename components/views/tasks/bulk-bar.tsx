"use client"

/**
 * BulkBar — barra flotante de acciones en bulk para el kanban/lista.
 *
 * Aparece sticky-bottom cuando hay >0 tasks seleccionadas. Permite
 * cambiar status, prioridad, asignar usuario, mover a depto, borrar
 * todas. Pattern Linear/Notion: el "command" para selecciones
 * múltiples vive cerca de la mano del user, no en un menú lejano.
 *
 * Cada popover se controla con click (no hover) — más estable y
 * accesible que dropdowns que dependen de mantener el mouse encima.
 * Esc cierra el popover activo.
 *
 * El bar mismo no maneja el state ni la persistencia: llama a los
 * handlers que el parent provee. El parent ya tiene optimistic UI +
 * rollback en bulkPatch/bulkDelete (PR 2) → gratis.
 */

import { useEffect, useRef, useState } from "react"
import { Portal } from "@/components/ui/portal"
import {
  Circle, Flag, ChevronDown, Trash2, X, Users, Layers, Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  PRIORITY_OPTIONS, PRIORITY_STYLE,
  type Status, type Priority, type StatusDef,
} from "./_types"

interface DepartmentLite { id: string; name: string; color: string }

interface Props {
  count:           number
  onClear:         () => void
  onSetStatus:     (s: Status)   => void
  onSetPriority:   (p: Priority) => void
  /** Reemplaza el array de assignees con un solo email. null = limpiar. */
  onSetAssignees:  (emails: string[]) => void
  /** Cambia department_id. null = "sin depto". */
  onSetDepartment: (id: string | null) => void
  onDelete:        () => void
  statuses:        StatusDef[]
  /** Emails distintos que aparecen en las tasks actuales — fuente del picker. */
  knownAssignees:  string[]
  departments:     DepartmentLite[]
}

type PopoverId = "status" | "priority" | "assignee" | "department" | null

export function BulkBar({
  count, onClear, onSetStatus, onSetPriority, onSetAssignees, onSetDepartment,
  onDelete, statuses, knownAssignees, departments,
}: Props) {
  const [open, setOpen] = useState<PopoverId>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Cerrar popover al click fuera o ESC.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (open) {
          e.preventDefault()
          e.stopPropagation()
          setOpen(null)
        }
      }
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey, true)
    }
  }, [open])

  const select = <T,>(value: T, action: (v: T) => void) => {
    action(value)
    setOpen(null)
  }

  return (
    <Portal>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] animate-in slide-in-from-bottom-4 fade-in duration-200">
        <div
          ref={rootRef}
          className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-[0_20px_40px_rgba(15,23,42,0.15)]"
        >
          {/* Contador */}
          <div className="flex items-center gap-2 pr-2 border-r border-border">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a8a] text-[12px] font-bold text-white">
              {count}
            </span>
            <span className="text-[12px] font-medium text-muted-foreground">
              {count === 1 ? "seleccionada" : "seleccionadas"}
            </span>
          </div>

          {/* Status */}
          <BulkButton
            label="Estado"
            icon={<Circle className="h-3 w-3" />}
            active={open === "status"}
            onClick={() => setOpen(open === "status" ? null : "status")}
          />

          {/* Priority */}
          <BulkButton
            label="Prioridad"
            icon={<Flag className="h-3 w-3" />}
            active={open === "priority"}
            onClick={() => setOpen(open === "priority" ? null : "priority")}
          />

          {/* Assignee */}
          <BulkButton
            label="Asignar"
            icon={<Users className="h-3 w-3" />}
            active={open === "assignee"}
            onClick={() => setOpen(open === "assignee" ? null : "assignee")}
          />

          {/* Department */}
          <BulkButton
            label="Depto"
            icon={<Layers className="h-3 w-3" />}
            active={open === "department"}
            onClick={() => setOpen(open === "department" ? null : "department")}
          />

          {/* Delete */}
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 h-8 rounded-lg border border-red-200 bg-red-50 px-2.5 text-[12px] font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            <Trash2 className="h-3 w-3" /> Borrar
          </button>

          {/* Clear */}
          <div className="border-l border-border pl-2">
            <button
              onClick={onClear}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Cancelar (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ─── POPOVERS ──────────────────────────────────────────────── */}
          {open === "status" && (
            <Popover>
              {statuses.map(s => (
                <PopoverItem key={s.key} onClick={() => select(s.key, onSetStatus)}>
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  {s.label}
                </PopoverItem>
              ))}
            </Popover>
          )}

          {open === "priority" && (
            <Popover>
              {PRIORITY_OPTIONS.map(p => (
                <PopoverItem key={p} onClick={() => select(p, onSetPriority)}>
                  <Flag className={`h-3 w-3 shrink-0 ${PRIORITY_STYLE[p].flag}`} />
                  <span className="capitalize">{p}</span>
                </PopoverItem>
              ))}
            </Popover>
          )}

          {open === "assignee" && (
            <Popover>
              <PopoverItem onClick={() => select([], onSetAssignees)} muted>
                <X className="h-3 w-3 shrink-0" />
                Sin asignar
              </PopoverItem>
              {knownAssignees.length === 0 ? (
                <PopoverEmpty>Sin asignados disponibles todavía.</PopoverEmpty>
              ) : (
                knownAssignees.map(email => (
                  <PopoverItem
                    key={email}
                    onClick={() => select([email], onSetAssignees)}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#E42D2C] to-[#1e3a8a] text-[9px] font-bold text-white shrink-0">
                      {initials(email)}
                    </span>
                    <span className="truncate">{email}</span>
                  </PopoverItem>
                ))
              )}
            </Popover>
          )}

          {open === "department" && (
            <Popover>
              <PopoverItem onClick={() => select(null, onSetDepartment)} muted>
                <X className="h-3 w-3 shrink-0" />
                Sin departamento
              </PopoverItem>
              {departments.length === 0 ? (
                <PopoverEmpty>No hay departamentos creados.</PopoverEmpty>
              ) : (
                departments.map(d => (
                  <PopoverItem
                    key={d.id}
                    onClick={() => select(d.id, onSetDepartment)}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </PopoverItem>
                ))
              )}
            </Popover>
          )}
        </div>
      </div>
    </Portal>
  )
}

// ─── Sub-pieces ──────────────────────────────────────────────────────────────

function BulkButton({
  label, icon, active, onClick,
}: {
  label: string
  icon:  React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 h-8 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
        active
          ? "border-[#1e3a8a]/40 bg-[#1e3a8a]/[0.06] text-[#1e3a8a]"
          : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
      )}
    >
      {icon}
      {label}
      <ChevronDown className={cn("h-3 w-3 transition-transform", active ? "rotate-180" : "")} />
    </button>
  )
}

function Popover({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 z-[121]">
      <div className="mx-auto w-fit min-w-[200px] max-w-[300px] max-h-[280px] overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_12px_32px_rgba(15,23,42,0.18)] animate-in fade-in slide-in-from-bottom-1 duration-150">
        <div className="p-1">{children}</div>
      </div>
    </div>
  )
}

function PopoverItem({
  onClick, children, muted = false,
}: {
  onClick:  () => void
  children: React.ReactNode
  muted?:   boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px]",
        "transition-colors",
        muted
          ? "text-muted-foreground hover:bg-muted hover:text-foreground"
          : "text-foreground hover:bg-muted",
      )}
    >
      {children}
      <Check className="h-3 w-3 ml-auto opacity-0" />
    </button>
  )
}

function PopoverEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-2 text-[11.5px] text-muted-foreground italic">
      {children}
    </p>
  )
}

// Local copy del helper (evita importarlo y crear ciclo si _helpers reusara esto).
function initials(s: string): string {
  return s.split(/[\s@]/).map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
}
