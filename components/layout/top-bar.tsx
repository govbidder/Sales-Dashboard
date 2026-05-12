"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { ChevronDown, LogOut, Menu, Search, Command, Sun, Moon, Monitor, Sparkles } from "lucide-react"
import { MonthSelector } from "@/components/layout/month-selector"
import { NotificationsBell } from "@/components/layout/notifications-bell"
import { useTheme } from "@/components/ui/theme-provider"
import { type Role, ROLE_LABEL, isAdminOrAbove, isSuperAdmin, isDeveloper } from "@/lib/types/role"

interface TopBarProps {
  pageTitle:        string
  user:             { email: string; name: string; role: Role } | null
  selectedMonth:    string
  onMonthChange:    (m: string) => void
  onOpenPalette:    () => void
  onOpenSidebar:    () => void
  onSignOut:        () => void
}

const CRUMB_GROUPS: Record<string, string> = {
  "/inicio":                "Inicio",
  "/dashboard":             "General",
  "/sales":                 "General",
  "/metrics":               "General",
  "/admin/reports":         "General",
  "/admin/personas":        "Operación",
  "/admin/tasks":           "Operación",
  "/admin/team":            "Operación",
  "/admin/centro-operativo":"Operación",
  "/admin/activity":         "Operación",
  "/admin/forms":            "Operación",
  "/admin/task-templates":   "Operación",
  "/admin/audit-log":        "Operación",
  "/tools":                 "Programa",
  "/recursos":              "Programa",
  "/calendar":              "Programa",
}

export function TopBar({
  pageTitle, user, selectedMonth, onMonthChange,
  onOpenPalette, onOpenSidebar, onSignOut,
}: TopBarProps) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement | null>(null)
  const { theme, setTheme } = useTheme()

  const [isMac, setIsMac] = useState(true)
  useEffect(() => {
    if (typeof navigator !== "undefined") setIsMac(/Mac/i.test(navigator.platform))
  }, [])

  useEffect(() => {
    function onMouse(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setProfileOpen(false)
    }
    document.addEventListener("mousedown", onMouse)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onMouse)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  const initials = (user?.name ?? "?")
    .split(/[\s@]/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const crumb = CRUMB_GROUPS[pathname] ?? null

  return (
    <header className="sticky top-0 z-10 border-b-2 border-[#1e3a8a]/10 dark:border-[#1e3a8a]/30 bg-white/85 dark:bg-[#080d1e]/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">

        {/* Mobile sidebar trigger */}
        <button
          onClick={onOpenSidebar}
          className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Page title with breadcrumb */}
        <div className="flex flex-col min-w-0">
          {crumb && (
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]/70 leading-none">
              {crumb}
            </span>
          )}
          <h1 className="text-[16px] sm:text-[18px] font-bold tracking-tight text-[#1e3a8a] mt-0.5 leading-none truncate">
            {pageTitle}
          </h1>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search palette trigger */}
        <button
          onClick={onOpenPalette}
          className="hidden md:flex items-center gap-2 h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-500 hover:border-[#1e3a8a]/30 hover:text-slate-700 transition-all"
          title="Buscar · ⌘K"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Buscar</span>
          <kbd className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 ml-2">
            {isMac ? "⌘" : "Ctrl"}K
          </kbd>
        </button>

        {/* Month selector */}
        <div className="hidden md:block">
          <MonthSelector
            value={selectedMonth}
            onChange={onMonthChange}
            enabledMonths={[]}
          />
        </div>

        {/* Notifications bell */}
        <NotificationsBell />

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            className="group flex items-center h-10 rounded-full pl-1 pr-1 transition-all hover:bg-slate-100"
            onClick={() => setProfileOpen(v => !v)}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#E42D2C] to-[#1e3a8a] text-[11px] font-bold text-white shadow-sm ring-2 ring-white">
              {initials}
            </span>
          </button>

          {profileOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.10)] page-enter"
            >
              <div className="px-4 py-3.5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#E42D2C] to-[#1e3a8a] text-sm font-bold text-white">
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                  </div>
                </div>
                {user?.role && isAdminOrAbove(user.role) && (
                  <span className={`mt-2.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isDeveloper(user.role)
                      ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-700"
                      : isSuperAdmin(user.role)
                      ? "border-purple-400/30 bg-purple-400/10 text-purple-700"
                      : "border-[#1e3a8a]/20 bg-[#1e3a8a]/[0.06] text-[#1e3a8a]"
                  }`}>
                    {isDeveloper(user.role) ? <Sparkles className="h-2.5 w-2.5" /> : "★"}
                    {ROLE_LABEL[user.role]}
                  </span>
                )}
              </div>
              {/* Theme toggle */}
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Tema</p>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
                  {[
                    { k: "light"  as const, label: "Claro",   Icon: Sun     },
                    { k: "dark"   as const, label: "Oscuro",  Icon: Moon    },
                    { k: "system" as const, label: "Sistema", Icon: Monitor },
                  ].map(o => (
                    <button
                      key={o.k}
                      onClick={() => setTheme(o.k)}
                      className={`flex flex-1 items-center justify-center gap-1 h-7 rounded-md text-[10.5px] font-bold transition-all ${
                        theme === o.k
                          ? "bg-white text-[#1e3a8a] shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      <o.Icon className="h-3 w-3" />
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                onClick={() => { setProfileOpen(false); onSignOut() }}
              >
                <LogOut className="h-4 w-4 text-slate-400" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
