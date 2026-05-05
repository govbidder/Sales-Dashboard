"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  X, BarChart3, DollarSign, LayoutGrid, FileBarChart,
  Users2, ListTodo, Users, Layers, Wrench, BookOpen, CalendarDays,
  Activity, ChevronLeft, ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  /** Whether the sidebar is open (mobile) */
  open:        boolean
  onClose:     () => void
  /** Whether the sidebar is collapsed to icon-only mode (desktop) */
  collapsed:   boolean
  onToggleCollapse: () => void
}

interface NavItem {
  name:  string
  href:  string
  icon:  any
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Inicio",
    items: [
      { name: "Página Principal", href: "/inicio", icon: Activity },
    ],
  },
  {
    label: "General",
    items: [
      { name: "Panel",            href: "/dashboard",      icon: BarChart3   },
      { name: "Ingresos",         href: "/sales",          icon: DollarSign  },
      { name: "Métricas",         href: "/metrics",        icon: LayoutGrid  },
      { name: "Cargar Métricas",  href: "/admin/reports",  icon: FileBarChart },
    ],
  },
  {
    label: "Operación",
    items: [
      { name: "Personas Agendadas", href: "/admin/personas",         icon: Users2   },
      { name: "Tareas",             href: "/admin/tasks",            icon: ListTodo },
      { name: "Equipo",             href: "/admin/team",             icon: Users    },
      { name: "Centro Operativo",   href: "/admin/centro-operativo", icon: Layers   },
    ],
  },
  {
    label: "Programa",
    items: [
      { name: "Herramientas", href: "/tools",    icon: Wrench       },
      { name: "Recursos",     href: "/recursos", icon: BookOpen     },
      { name: "Agenda",       href: "/calendar", icon: CalendarDays },
    ],
  },
]

export function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
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
          "flex flex-col bg-white border-r-2 border-[#1e3a8a]/10",
          // Width transitions
          collapsed && !isMobile ? "lg:w-[72px]" : "lg:w-[240px]",
          "w-[240px]",
          // Mobile: slide in/out
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Brand */}
        <div className={cn(
          "relative flex flex-shrink-0 items-center border-b-2 border-[#1e3a8a]/10",
          showLabels ? "h-20 px-4" : "h-20 px-3 justify-center",
        )}>
          <Link href="/inicio" className="flex items-center justify-center hover:opacity-90 transition-opacity overflow-hidden">
            {showLabels ? (
              <Image
                src="/icon.png"
                alt="GovBidder"
                width={200}
                height={150}
                className="h-16 w-auto object-contain mix-blend-multiply"
                priority
              />
            ) : (
              // Collapsed: show only top portion of the logo (the eagle)
              <div className="h-12 w-12 overflow-hidden flex items-center justify-center">
                <Image
                  src="/icon.png"
                  alt="GovBidder"
                  width={120}
                  height={120}
                  className="h-20 w-auto object-cover object-top mix-blend-multiply"
                  priority
                />
              </div>
            )}
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
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {showLabels && (
                <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]/70">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
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
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex flex-shrink-0 border-t-2 border-[#1e3a8a]/10 p-2">
          <button
            onClick={onToggleCollapse}
            className={cn(
              "group flex items-center gap-2 rounded-lg transition-all hover:bg-slate-100",
              showLabels ? "w-full px-3 py-2 justify-start" : "h-10 w-12 mx-auto justify-center",
            )}
            title={collapsed ? "Expandir" : "Colapsar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-[#1e3a8a]" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-slate-500 group-hover:text-[#1e3a8a]" />
            )}
            {showLabels && (
              <span className="text-[12px] font-medium text-slate-500 group-hover:text-[#1e3a8a]">
                Colapsar
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
