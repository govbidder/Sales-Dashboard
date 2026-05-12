"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  X, LayoutGrid,
  Users2, ListTodo, Users, Layers, Wrench, BookOpen, CalendarDays,
  Home, ChevronLeft, ChevronRight, Rss, FormInput, Shield, LayoutTemplate,
  Folder, Settings, Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { type Role, isAdminOrAbove } from "@/lib/types/role"

interface DepartmentLite {
  id:    string
  name:  string
  color: string
}

interface SidebarProps {
  open:              boolean
  onClose:           () => void
  collapsed:         boolean
  onToggleCollapse:  () => void
  /** Rol que gobierna qué se ve. Puede ser real o simulado vía view-as. */
  role:              Role
  /** Depto del usuario actual (para Team users — define "Mi área"). */
  userDepartmentId:  string | null
  /** Lista de departamentos (para admin+ → sección "Por departamento"). */
  departments:       DepartmentLite[]
}

interface NavItem {
  name: string
  href: string
  icon: any
}

interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * Construye los grupos de navegación según el rol del caller.
 *
 * - Team (rol=user/viewer): vista reducida — solo SU depto + Agenda + Actividad.
 *   No ve Personas Agendadas, ni Performance, ni Admin.
 * - Admin / Founder / Developer: orden por prioridad operativa:
 *   Inicio → Operación → Performance → Equipo → Admin. Los deptos son un
 *   rail compacto de pills al final, no items full-text que inflen el sidebar.
 */
function buildNavGroups(
  role:             Role,
  userDepartmentId: string | null,
  departments:      DepartmentLite[],
): NavGroup[] {
  const isAdmin = isAdminOrAbove(role)

  if (!isAdmin) {
    // ── TEAM ─────────────────────────────────────────────────────────────────
    const myDept = userDepartmentId
      ? departments.find(d => d.id === userDepartmentId)
      : null

    const myAreaItems: NavItem[] = []
    if (myDept) {
      myAreaItems.push({ name: "Dashboard", href: `/admin/departments/${myDept.id}`, icon: Folder })
      myAreaItems.push({ name: "Kanban",    href: `/admin/tasks?department=${myDept.id}`, icon: ListTodo })
    } else {
      myAreaItems.push({ name: "Tareas", href: "/admin/tasks", icon: ListTodo })
    }

    return [
      { label: "Inicio", items: [{ name: "Hoy", href: "/inicio", icon: Home }] },
      { label: myDept ? `Mi área — ${myDept.name}` : "Mi área", items: myAreaItems },
      {
        label: "General",
        items: [
          { name: "Agenda",    href: "/calendar",        icon: CalendarDays },
          { name: "Actividad", href: "/admin/activity",  icon: Rss          },
        ],
      },
    ]
  }

  // ── ADMIN / FOUNDER / DEVELOPER ──────────────────────────────────────────
  return [
    { label: "Inicio", items: [{ name: "Hoy", href: "/inicio", icon: Home }] },
    {
      label: "Operación",
      items: [
        { name: "Personas Agendadas", href: "/admin/personas", icon: Users2       },
        { name: "Tareas",             href: "/admin/tasks",    icon: ListTodo     },
        { name: "Agenda",             href: "/calendar",       icon: CalendarDays },
      ],
    },
    {
      label: "Performance",
      items: [
        { name: "Métricas", href: "/metrics", icon: LayoutGrid },
      ],
    },
    {
      label: "Departamentos",
      items: [
        { name: "Ver todos", href: "/admin/departments", icon: Layers },
      ],
    },
    {
      label: "Equipo",
      items: [
        { name: "Miembros",  href: "/admin/team",     icon: Users },
        { name: "Actividad", href: "/admin/activity", icon: Rss   },
      ],
    },
    {
      label: "Admin",
      items: [
        { name: "Templates", href: "/admin/task-templates",   icon: LayoutTemplate },
        { name: "Forms",     href: "/admin/forms",            icon: FormInput      },
        { name: "Procesos",  href: "/admin/centro-operativo", icon: Settings       },
        { name: "Auditoría", href: "/admin/audit-log",        icon: Shield         },
        { name: "Recursos",  href: "/recursos",               icon: BookOpen       },
        { name: "Tools",     href: "/tools",                  icon: Wrench         },
      ],
    },
  ]
}

export function Sidebar({
  open, onClose, collapsed, onToggleCollapse,
  role, userDepartmentId, departments,
}: SidebarProps) {
  const pathname = usePathname()

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const showLabels = !collapsed || isMobile
  const isAdmin    = isAdminOrAbove(role)

  const navGroups = buildNavGroups(role, userDepartmentId, departments)

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full transition-all duration-300 ease-out",
          "flex flex-col bg-white dark:bg-[#080d1e] border-r-2 border-[#1e3a8a]/10 dark:border-[#1e3a8a]/30",
          collapsed && !isMobile ? "lg:w-[80px]" : "lg:w-[240px]",
          "w-[240px]",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Brand */}
        <div className={cn(
          "relative flex flex-shrink-0 items-center border-b-2 border-[#1e3a8a]/10",
          showLabels ? "h-16 px-4" : "h-16 px-2 justify-center",
        )}>
          <Link href="/inicio" className="flex items-center justify-center hover:opacity-90 transition-opacity">
            <Image
              src="/icon.png"
              alt="GovBidder General Dashboard"
              width={200}
              height={150}
              className={cn(
                "w-auto object-contain",
                showLabels ? "h-12" : "h-9",
              )}
              priority
            />
          </Link>

          <button
            className="lg:hidden absolute right-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden py-4",
          showLabels ? "px-3 space-y-5" : "px-2 space-y-4",
        )}>
          {navGroups.map((group) => {
            if (group.items.length === 0) return null
            return (
              <div key={group.label}>
                {showLabels && (
                  <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]/70 truncate">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const itemBase = item.href.split("?")[0]
                    const isActive = !item.href.includes("?") && pathname === itemBase
                    const Icon = item.icon

                    return (
                      <Link
                        key={item.name + item.href}
                        href={item.href}
                        onClick={onClose}
                        title={!showLabels ? item.name : undefined}
                        className={cn(
                          "group relative flex items-center rounded-xl transition-all duration-200",
                          showLabels ? "gap-2.5 px-3 py-2" : "justify-center h-10 w-12 mx-auto",
                          isActive
                            ? "bg-[#1e3a8a]/[0.10] text-[#1e3a8a]"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#1e3a8a] shadow-[0_0_12px_rgba(30,58,138,0.40)]" />
                        )}

                        <Icon
                          className={cn(
                            "shrink-0 transition-colors",
                            showLabels ? "h-[16px] w-[16px]" : "h-[18px] w-[18px]",
                            isActive ? "text-[#1e3a8a]" : "text-slate-500 group-hover:text-slate-700"
                          )}
                        />
                        {showLabels && (
                          <span
                            className={cn(
                              "text-[13px] leading-none truncate",
                              isActive ? "font-semibold" : "font-medium"
                            )}
                          >
                            {item.name}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}

        </nav>

        {/* CRM portal trigger — separado por divisor, tratamiento visual
            distinto para anticipar que abre "otro mundo" (la puerta de Narnia).
            Cmd+Shift+C también lo abre desde cualquier parte del dashboard. */}
        <div className={cn("shrink-0 border-t-2 border-[#1e3a8a]/10", showLabels ? "px-3 py-3" : "px-2 py-3")}>
          <Link
            href="/crm"
            onClick={onClose}
            title={!showLabels ? "Abrir CRM (⌘⇧C)" : undefined}
            className={cn(
              "group relative flex items-center overflow-hidden rounded-xl transition-all duration-300",
              "bg-gradient-to-br from-[#1e3a8a] to-[#0f1f5c] text-white",
              "shadow-[0_8px_24px_-8px_rgba(30,58,138,0.55)]",
              "hover:shadow-[0_12px_32px_-8px_rgba(30,58,138,0.75)] hover:-translate-y-0.5",
              showLabels ? "gap-3 px-3 py-2.5" : "justify-center h-10 w-12 mx-auto",
            )}
          >
            {/* Glow that animates on hover */}
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#E42D2C]/0 via-[#E42D2C]/0 to-[#E42D2C]/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <Sparkles className={cn(
              "relative shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12",
              showLabels ? "h-[18px] w-[18px]" : "h-[20px] w-[20px]",
            )} />
            {showLabels && (
              <>
                <span className="relative flex-1 min-w-0">
                  <span className="block text-[13px] font-bold leading-none tracking-tight">
                    Abrir CRM
                  </span>
                  <span className="block text-[10px] font-medium leading-none mt-1 text-white/60">
                    Nuevo módulo · Beta
                  </span>
                </span>
                <kbd className="relative shrink-0 hidden lg:inline-flex items-center gap-0.5 rounded border border-white/15 bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-mono text-white/70">
                  ⌘⇧C
                </kbd>
              </>
            )}
          </Link>
        </div>


        {/* Floating collapse toggle */}
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          title={collapsed ? "Expandir" : "Colapsar"}
          className={cn(
            "hidden lg:flex absolute top-[20px] -right-3 z-10",
            "h-6 w-6 items-center justify-center rounded-full",
            "border border-[#1e3a8a]/15 bg-white text-slate-500",
            "shadow-[0_2px_8px_rgba(15,23,42,0.08)]",
            "transition-all duration-200",
            "hover:border-[#1e3a8a]/40 hover:text-[#1e3a8a] hover:scale-110",
            "hover:shadow-[0_4px_12px_rgba(30,58,138,0.18)]",
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </aside>
    </>
  )
}
