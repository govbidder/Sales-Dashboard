"use client"

/**
 * Drawer/popover en el top-bar para que los developers cambien su
 * "view-as". Solo se renderiza si el rol real del usuario es `developer`.
 *
 * 4 secciones:
 *  1. Simular rol
 *  2. Simular departamento (solo si rol simulado es user/viewer)
 *  3. Simular usuario específico (con search)
 *  4. Botón "Volver a Developer (real)" si hay alguna simulación activa
 */

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Eye, Check, Crown, Sparkles, Shield, User as UserIcon, EyeOff,
  Search, X, Layers,
} from "lucide-react"
import { useViewAs } from "@/lib/contexts/view-as-context"
import { type Role, ROLE_LABEL, isDeveloper } from "@/lib/types/role"

interface ViewAsDropdownProps {
  realRole: Role | null | undefined
}

const ROLE_OPTIONS: Array<{ value: Role | null; icon: any; iconColor: string }> = [
  { value: null,           icon: EyeOff,   iconColor: "text-cyan-600"   },
  { value: "super_admin",  icon: Sparkles, iconColor: "text-purple-600" },
  { value: "admin",        icon: Crown,    iconColor: "text-amber-600"  },
  { value: "user",         icon: UserIcon, iconColor: "text-muted-foreground"  },
  { value: "viewer",       icon: Shield,   iconColor: "text-muted-foreground"  },
]

function initials(s: string | null) {
  if (!s) return "?"
  return s.split(/[\s@]/).map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
}

export function ViewAsDropdown({ realRole }: ViewAsDropdownProps) {
  const {
    viewAsRole, viewAsDepartmentId, viewAsUser, isViewing,
    members, departments,
    setViewAsRole, setViewAsDepartmentId, setViewAsUser, clearViewAs,
  } = useViewAs()

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
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

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members.slice(0, 8)
    const q = search.toLowerCase()
    return members
      .filter(m =>
        (m.full_name?.toLowerCase().includes(q)) ||
        (m.email?.toLowerCase().includes(q))
      )
      .slice(0, 8)
  }, [members, search])

  if (!isDeveloper(realRole)) return null

  // Label del botón en el top-bar — refleja qué se está simulando.
  let btnLabel = "Developer"
  if (viewAsUser) btnLabel = viewAsUser.full_name || viewAsUser.email || "Usuario"
  else if (viewAsRole) btnLabel = ROLE_LABEL[viewAsRole]

  // Cuál rol mostrar como "activo" en el bloque 1. Si hay user simulado,
  // su rol es el simulado.
  const activeRoleValue: Role | null = viewAsUser?.role ?? viewAsRole

  // Sección depto solo aplica si el rol simulado es user o viewer.
  const showDeptSection = activeRoleValue === "user" || activeRoleValue === "viewer"

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Simular otro rol/depto/usuario (solo afecta la UI)"
        className={`hidden md:flex items-center gap-1.5 h-9 rounded-lg border px-3 text-[12px] font-semibold transition-all max-w-[180px] ${
          isViewing
            ? "border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200"
            : "border-cyan-400/40 bg-cyan-400/10 text-cyan-700 hover:bg-cyan-400/20"
        }`}
      >
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{btnLabel}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[340px] max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-[0_20px_40px_rgba(15,23,42,0.10)] page-enter"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 px-4 py-2.5 border-b border-border bg-muted/95 backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              View As · simulación visual
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
              Cambia solo la UI. El servidor te sigue tratando como Developer.
            </p>
          </div>

          {/* SECCIÓN 1 — ROL */}
          <div className="px-2 pt-2 pb-1">
            <p className="px-2 pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Rol
            </p>
            {ROLE_OPTIONS.map(opt => {
              const Icon = opt.icon
              const isActive = (opt.value === null && !viewAsRole && !viewAsUser) ||
                               (opt.value !== null && opt.value === activeRoleValue)
              const label = opt.value === null ? "Developer (real)" : ROLE_LABEL[opt.value]
              return (
                <button
                  key={opt.value ?? "real"}
                  onClick={() => {
                    if (opt.value === null) { clearViewAs(); setOpen(false) }
                    else { setViewAsUser(null); setViewAsRole(opt.value) }
                  }}
                  role="menuitem"
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] text-left transition-colors ${
                    isActive
                      ? "bg-muted text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${opt.iconColor}`} />
                  <span className="flex-1 truncate">{label}</span>
                  {isActive && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                </button>
              )
            })}
          </div>

          {/* SECCIÓN 2 — DEPARTAMENTO (solo si rol simulado es user/viewer) */}
          {showDeptSection && (
            <div className="px-2 pt-2 pb-1 border-t border-border mt-1">
              <p className="px-2 pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Departamento
              </p>
              <button
                onClick={() => setViewAsDepartmentId(null)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] text-left transition-colors ${
                  !viewAsDepartmentId
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1">Todos</span>
                {!viewAsDepartmentId && <Check className="h-3.5 w-3.5 text-emerald-600" />}
              </button>
              {departments.map(d => {
                const isActive = viewAsDepartmentId === d.id
                return (
                  <button
                    key={d.id}
                    onClick={() => setViewAsDepartmentId(d.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] text-left transition-colors ${
                      isActive
                        ? "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="flex-1 truncate">{d.name}</span>
                    {isActive && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                  </button>
                )
              })}
              {departments.length === 0 && (
                <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Cargando departamentos…</p>
              )}
            </div>
          )}

          {/* SECCIÓN 3 — USUARIO ESPECÍFICO */}
          <div className="px-2 pt-2 pb-2 border-t border-border mt-1">
            <p className="px-2 pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Usuario específico
            </p>
            <div className="relative px-2 mb-1">
              <Search className="h-3.5 w-3.5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nombre o email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-8 pl-7 pr-2 rounded-lg border border-border bg-muted text-[12px] text-foreground placeholder:text-muted-foreground focus:border-border focus:outline-none"
              />
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {filteredMembers.length === 0 && (
                <p className="px-2 py-2 text-[11px] text-muted-foreground">
                  {members.length === 0 ? "Cargando equipo…" : "Sin resultados"}
                </p>
              )}
              {filteredMembers.map(m => {
                const isActive = viewAsUser?.id === m.id
                const name = m.full_name || m.email || "Sin nombre"
                return (
                  <button
                    key={m.id}
                    onClick={() => { setViewAsUser(m); setSearch(""); setOpen(false) }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] text-left transition-colors ${
                      isActive
                        ? "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E42D2C]/40 to-[#152978] text-[9px] font-bold text-white">
                      {initials(name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] leading-tight truncate">{name}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight truncate">
                        {ROLE_LABEL[m.role]}{m.email ? ` · ${m.email}` : ""}
                      </p>
                    </div>
                    {isActive && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                  </button>
                )
              })}
            </div>
            {viewAsUser && (
              <button
                onClick={() => setViewAsUser(null)}
                className="mt-1 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
                Limpiar usuario simulado
              </button>
            )}
          </div>

          {/* SECCIÓN 4 — VOLVER A DEVELOPER (solo si hay simulación) */}
          {isViewing && (
            <div className="sticky bottom-0 px-3 py-3 border-t border-border bg-amber-50/80 backdrop-blur-sm">
              <button
                onClick={() => { clearViewAs(); setOpen(false) }}
                className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-amber-400 text-amber-950 text-[12px] font-bold hover:bg-amber-500 transition-colors"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Volver a Developer (real)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
