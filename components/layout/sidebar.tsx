"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  X, BarChart3, DollarSign, LayoutGrid, FileBarChart,
  Users2, ListTodo, Users, Layers, Wrench, BookOpen, CalendarDays,
  Home, ChevronLeft, ChevronRight, Rss, FormInput, Shield, LayoutTemplate,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { type Role, isAdminOrAbove } from "@/lib/types/role"

interface SidebarProps {
  /** Whether the sidebar is open (mobile) */
  open:        boolean
  onClose:     () => void
  /** Whether the sidebar is collapsed to icon-only mode (desktop) */
  collapsed:   boolean
  onToggleCollapse: () => void
  /** Caller's role — gates which items are visible. */
  role:        Role
}

interface NavItem {
  name:     string
  href:     string
  icon:     any
  /** Si está, item visible solo cuando el predicado retorna true. */
  visible?: (role: Role) => boolean
}

interface NavGroup {
  label:    string
  items:    NavItem[]
  /** Si está, el grupo ENTERO solo se muestra cuando el predicado retorna true. */
  visible?: (role: Role) => boolean
}

const adminOnly = (role: Role) => isAdminOrAbove(role)

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Inicio",
    items: [
      { name: "Hoy", href: "/inicio", icon: Home },
    ],
  },
  {
    label: "Performance",
    items: [
      { name: "Panel",          href: "/dashboard",     icon: BarChart3   },
      { name: "Ventas",         href: "/sales",         icon: DollarSign,   visible: adminOnly },
      { name: "Métricas",       href: "/metrics",       icon: LayoutGrid,   visible: adminOnly },
      { name: "Cargar reporte", href: "/admin/reports", icon: FileBarChart, visible: adminOnly },
    ],
  },
  {
    label: "Día a día",
    items: [
      { name: "Personas Agendadas", href: "/admin/personas", icon: Users2       },
      { name: "Tareas",             href: "/admin/tasks",    icon: ListTodo     },
      { name: "Agenda",             href: "/calendar",       icon: CalendarDays },
    ],
  },
  {
    label: "Equipo",
    visible: adminOnly,
    items: [
      { name: "Miembros",      href: "/admin/team",        icon: Users  },
      { name: "Departamentos", href: "/admin/departments", icon: Layers },
      { name: "Actividad",     href: "/admin/activity",    icon: Rss    },
    ],
  },
  {
    label: "Configuración",
    items: [
      { name: "Plantillas",       href: "/admin/task-templates",   icon: LayoutTemplate, visible: adminOnly },
      { name: "Formularios",      href: "/admin/forms",            icon: FormInput,      visible: adminOnly },
      { name: "Centro Operativo", href: "/admin/centro-operativo", icon: Layers,         visible: adminOnly },
      { name: "Auditoría",        href: "/admin/audit-log",        icon: Shield,         visible: adminOnly },
      { name: "Herramientas",     href: "/tools",                  icon: Wrench,         visible: adminOnly },
      { name: "Biblioteca",       href: "/recursos",               icon: BookOpen,       visible: adminOnly },
    ],
  },
]

export function Sidebar({ open, onClose, collapsed, onToggleCollapse, role }: SidebarProps) {
  const pathname = usePathname()

  // On mobile, show all labels even when "collapsed" prop is true.
  // The collapsed mode only applies on lg+ screens.
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const showLabels = !collapsed || isMobile

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
          // Width transitions
          collapsed && !isMobile ? "lg:w-[80px]" : "lg:w-[240px]",
          "w-[240px]",
          // Mobile: slide in/out
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Brand — height matches TopBar (h-16 = 64px) so the bottom borders align */}
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

          {/* Mobile close button */}
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
          {NAV_GROUPS.map((group) => {
            // Group-level gate first: si el grupo tiene `visible` y no pasa, se oculta entero.
            if (group.visible && !group.visible(role)) return null
            const visibleItems = group.items.filter(i => !i.visible || i.visible(role))
            if (visibleItems.length === 0) return null
            return (
            <div key={group.label}>
              {showLabels && (
                <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]/70">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.name}
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
                      {/* Active indicator bar */}
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

        {/* Floating collapse toggle on right edge — desktop only.
           Sits at topbar height (h-16/2 = 32px) so it visually anchors
           to the corner where sidebar+topbar borders meet. */}
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
