"use client"

/**
 * Dropdown en el top-bar para que los developers cambien su "view-as".
 * Solo se renderiza si el rol real del usuario es `developer`.
 */

import { useEffect, useRef, useState } from "react"
import { Eye, Check, Crown, Sparkles, Shield, User as UserIcon, EyeOff } from "lucide-react"
import { useViewAs } from "@/lib/contexts/view-as-context"
import { type Role, ROLE_LABEL, isDeveloper } from "@/lib/types/role"

interface ViewAsDropdownProps {
  /** Rol REAL del usuario (no afectado por viewAs). Si no es developer, no renderiza. */
  realRole: Role | null | undefined
}

const ROLE_OPTIONS: Array<{ value: Role | null; icon: any; iconColor: string }> = [
  { value: null,           icon: EyeOff,   iconColor: "text-cyan-600"   },   // limpiar = rol real (developer)
  { value: "super_admin",  icon: Sparkles, iconColor: "text-purple-600" },
  { value: "admin",        icon: Crown,    iconColor: "text-amber-600"  },
  { value: "user",         icon: UserIcon, iconColor: "text-slate-600"  },
  { value: "viewer",       icon: Shield,   iconColor: "text-slate-500"  },
]

export function ViewAsDropdown({ realRole }: ViewAsDropdownProps) {
  const { viewAsRole, setViewAsRole, isViewing } = useViewAs()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onMouse)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onMouse)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  if (!isDeveloper(realRole)) return null

  const activeRole: Role = viewAsRole ?? "developer"
  const activeLabel = isViewing ? ROLE_LABEL[activeRole] : "Developer"

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Simular otro rol (solo afecta la UI)"
        className={`hidden md:flex items-center gap-1.5 h-9 rounded-lg border px-3 text-[12px] font-semibold transition-all ${
          isViewing
            ? "border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200"
            : "border-cyan-400/40 bg-cyan-400/10 text-cyan-700 hover:bg-cyan-400/20"
        }`}
      >
        <Eye className="h-3.5 w-3.5" />
        <span>{activeLabel}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.10)] page-enter"
        >
          <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/60">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Ver como
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
              Cambia solo la UI. El servidor te sigue tratando como Developer.
            </p>
          </div>
          <div className="py-1">
            {ROLE_OPTIONS.map(opt => {
              const Icon = opt.icon
              const isActive = (opt.value === null && !isViewing) || (opt.value !== null && opt.value === viewAsRole)
              const label = opt.value === null ? "Developer (real)" : ROLE_LABEL[opt.value]
              return (
                <button
                  key={opt.value ?? "real"}
                  onClick={() => { setViewAsRole(opt.value); setOpen(false) }}
                  role="menuitem"
                  className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left transition-colors ${
                    isActive
                      ? "bg-slate-100 text-slate-900 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${opt.iconColor}`} />
                  <span className="flex-1 truncate">{label}</span>
                  {isActive && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
