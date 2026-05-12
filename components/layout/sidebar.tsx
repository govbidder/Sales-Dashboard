"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  X, BarChart3, DollarSign, LayoutGrid, FileBarChart,
  Users2, ListTodo, Users, Layers, Wrench, BookOpen, CalendarDays,
  Home, ChevronLeft, ChevronRight, Rss, FormInput, Shield, LayoutTemplate,
  Folder,
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
  name:     string
  href:     string
  icon:     any
  /** Color custom (ej: dept color en sección "Por departamento"). */
  iconColor?: string
}

interface NavGroup {
  label:  string
  items:  NavItem[]
}

/**
 * Construye dinámicamente los grupos de navegación según el rol del caller
 * y el depto del usuario (cuando aplica).
 *
 * - Team (rol=user) con depto → "Mi área — [Dept]" + General.
 *   Sus tareas se filtran al depto vía query param + server scoping.
 * - Admin/Founder/Developer → vista completa cross-empresa + "Por departamento".
 */
function buildNavGroups(
  role:             Role,
  userDepartmentId: string | null,
  departments:      DepartmentLite[],
): NavGroup[] {
  const isAdmin = isAdminOrAbove(role)

  if (!isAdmin) {
    // ── TEAM (rol=user/viewer) — su área + general ──────────────────────────
    const myDept = userDepartmentId
      ? departments.find(d => d.id === userDepartmentId)
      : null

    const myAreaItems: NavItem[] = []
    if (myDept) {
      // Dashboard del depto: KPIs + tareas + miembros, todo en una vista.
      myAreaItems.push({
        name:      "Dashboard",
        href:      `/admin/departments/${myDept.id}`,
        icon:      Folder,
        iconColor: myDept.color,
      })
      myAreaItems.push({
        name:      "Kanban",
        href:      `/admin/tasks?department=${myDept.id}`,
        icon:      ListTodo,
      })
    } else {
      // Sin depto asignado: lleva al kanban general (servidor seguirá scopeando
      // por owner/assignee).
      myAreaItems.push({ name: "Tareas", href: "/admin/tasks", icon: ListTodo })
    }
    myAreaItems.push({ name: "Personas Agendadas", href: "/admin/personas", icon: Users2 })

    return [
      {
        label: "Inicio",
        items: [{ name: "Hoy", href: "/inicio", icon: Home }],
      },
      {
        label: myDept ? `Mi área — ${myDept.name}` : "Mi área",
        items: myAreaItems,
      },
      {
        label: "General",
        items: [
          { name: "Agenda",          href: "/calendar",                icon: CalendarDays },
          { name: "Actividad",       href: "/admin/activity",          icon: Rss          },
        ],
      },
    ]
  }

  // ── ADMIN / FOUNDER / DEVELOPER — vista cross-empresa completa ────────────
  // Cada item de depto lleva al DASHBOARD del depto (KPIs + tareas + miembros),
  // no al kanban filtrado. Desde ahí se puede saltar al kanban si hace falta.
  const deptItems: NavItem[] = departments.map(d => ({
    name:      d.name,
    href:      `/admin/departments/${d.id}`,
    icon:      Folder,
    iconColor: d.color,
  }))

  return [
    {
      label: "Inicio",
      items: [{ name: "Hoy", href: "/inicio", icon: Home }],
    },
    {
      label: "Performance",
      items: [
        { name: "Panel",          href: "/dashboard",     icon: BarChart3    },
        { name: "Ventas",         href: "/sales",         icon: DollarSign   },
        { name: "Métricas",       href: "/metrics",       icon: LayoutGrid   },
        { name: "Cargar reporte", href: "/admin/reports", icon: FileBarChart },
      ],
    },
    // "Por departamento" — solo aparece si hay deptos cargados.
    ...(deptItems.length > 0 ? [{
      label: "Por departamento",
      items: deptItems,
    }] : []),
    {
      label: "Operación general",
      items: [
        { name: "Personas Agendadas", href: "/admin/personas", icon: Users2       },
        { name: "Tareas (todas)",     href: "/admin/tasks",    icon: ListTodo     },
        { name: "Agenda",             href: "/calendar",       icon: CalendarDays },
      ],
    },
    {
      label: "Equipo",
      items: [
        { name: "Miembros",      href: "/admin/team",        icon: Users  },
        { name: "Departamentos", href: "/admin/departments", icon: Layers },
        { name: "Actividad",     href: "/admin/activity",    icon: Rss    },
      ],
    },
    {
      label: "Configuración",
      items: [
        { name: "Plantillas",       href: "/admin/task-templates",   icon: LayoutTemplate },
        { name: "Formularios",      href: "/admin/forms",            icon: FormInput      },
        { name: "Centro Operativo", href: "/admin/centro-operativo", icon: Layers         },
        { name: "Auditoría",        href: "/admin/audit-log",        icon: Shield         },
        { name: "Herramientas",     href: "/tools",                  icon: Wrench         },
        { name: "Biblioteca",       href: "/recursos",               icon: BookOpen       },
      ],
    },
  ]
}

export function Sidebar({
  open, onClose, collapsed, onToggleCollapse,
  role, userDepartmentId, departments,
}: SidebarProps) {
  const pathname = usePathname()

  // On mobile, show all labels even when "collapsed" prop is true.
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const showLabels = !collapsed || isMobile

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
              alt="GovBidder"
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
                    // Active match: exacto en pathname. Si el item tiene query string,
                    // ignoramos el match porque varios items pueden compartir base
                    // path (ej: /admin/tasks?department=A vs ?department=B).
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
                          style={item.iconColor ? { color: item.iconColor } : undefined}
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
