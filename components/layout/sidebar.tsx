"use client"

import {
  X, BarChart3, DollarSign, FileSearch, Wrench,
  CalendarDays, LayoutGrid, ClipboardList,
  Zap, ChevronDown, Users2, BookOpen, Layers, Lock, ListTodo,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { name: "Bid Dashboard",  href: "/dashboard",  icon: BarChart3 },
      { name: "Revenue",        href: "/sales",      icon: DollarSign },
      { name: "Review",         href: "/reflection", icon: FileSearch },
      { name: "All Metrics",    href: "/metrics",    icon: LayoutGrid },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { name: "Personas Agendadas", href: "/admin/personas",         icon: Users2   },
      { name: "Tareas",             href: "/admin/tasks",            icon: ListTodo },
      { name: "Operations Center",  href: "/admin/centro-operativo", icon: Layers   },
    ],
  },
  {
    label: "Program",
    items: [
      { name: "Compliance Audit",  href: "/audit",             icon: ClipboardList },
      { name: "Implementation",    href: "/program-checklist", icon: Zap           },
      { name: "Tools",             href: "/tools",             icon: Wrench        },
      { name: "Resources",         href: "/recursos",          icon: BookOpen      },
      { name: "Schedule",          href: "/calendar",          icon: CalendarDays  },
    ],
  },
]

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleGroup = (label: string) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-[220px] border-r border-white/[0.07] transition-transform duration-300 ease-in-out lg:translate-x-0",
          "bg-[#0d1745] flex flex-col",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-white/[0.07] px-5">
          <a href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <span className="text-white text-xl font-bold tracking-tight">Gov</span>
            <span className="rounded-md bg-[#E42D2C] px-2.5 py-1 text-base font-bold tracking-tight text-white shadow-sm">
              Bidder
            </span>
          </a>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold text-white/25 tracking-widest uppercase">
              v1.0
            </span>
            <button
              className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-all"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_GROUPS.map((group) => {
            const isCollapsed = collapsed[group.label]
            const hasActive = group.items.some(i => pathname === i.href)

            return (
              <div key={group.label} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition-all duration-150",
                    "hover:bg-white/[0.05]",
                    hasActive && isCollapsed ? "text-[#E42D2C]" : "text-white/80"
                  )}
                >
                  <span className="text-[13px] font-semibold tracking-wide">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-white/30 transition-transform duration-200 flex-shrink-0",
                      isCollapsed && "-rotate-90"
                    )}
                  />
                </button>

                {!isCollapsed && (
                  <div className="mt-0.5 space-y-0.5 pl-1">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href

                      if ((item as any).disabled) {
                        return (
                          <div
                            key={item.name}
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2 opacity-25 cursor-not-allowed select-none"
                          >
                            <item.icon className="h-[14px] w-[14px] text-white/40 flex-shrink-0" />
                            <span className="text-[13px] text-white/40">{item.name}</span>
                            <Lock className="ml-auto h-3 w-3 text-white/25 flex-shrink-0" />
                          </div>
                        )
                      }

                      return (
                        <Link key={item.name} href={item.href} onClick={onClose}>
                          <div
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-3 py-[7px] transition-all duration-150",
                              isActive
                                ? "bg-[#E42D2C]/10 text-[#E42D2C]"
                                : "text-white/75 hover:bg-white/[0.05] hover:text-white"
                            )}
                          >
                            <item.icon
                              className={cn(
                                "h-[14px] w-[14px] flex-shrink-0",
                                isActive ? "text-[#E42D2C]" : "text-white/50"
                              )}
                            />
                            <span className={cn(
                              "text-[13px] leading-none",
                              isActive ? "font-semibold" : "font-medium"
                            )}>
                              {item.name}
                            </span>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-white/[0.07] p-4">
          <div className="flex items-center gap-2.5 rounded-xl bg-[#E42D2C]/[0.08] px-3 py-2.5 border border-[#E42D2C]/20">
            <span className="flex h-1.5 w-1.5 rounded-full bg-[#E42D2C] animate-pulse flex-shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-[#E42D2C]/80 tracking-widest uppercase">Internal</p>
              <p className="text-[10px] text-white/30 mt-0.5">Operations Dashboard</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
