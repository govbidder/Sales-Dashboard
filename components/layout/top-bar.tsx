"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Command, Search, ChevronRight, LogOut, User as UserIcon,
} from "lucide-react"
import { MonthSelector } from "@/components/layout/month-selector"

interface TopBarProps {
  pageTitle:        string
  user:             { email: string; name: string; role: "admin" | "user" } | null
  selectedMonth:    string
  onMonthChange:    (m: string) => void
  onOpenPalette:    () => void
  onSignOut:        () => void
}

// Map of paths to crumb labels (for breadcrumbs)
const CRUMB_GROUPS: Record<string, string> = {
  "/dashboard":             "Overview",
  "/sales":                 "Overview",
  "/reflection":            "Overview",
  "/metrics":               "Overview",
  "/admin/reports":         "Overview",
  "/admin/personas":        "Pipeline",
  "/admin/tasks":           "Pipeline",
  "/admin/team":            "Pipeline",
  "/admin/centro-operativo":"Pipeline",
  "/audit":                 "Program",
  "/tools":                 "Program",
  "/recursos":              "Program",
  "/calendar":              "Program",
}

export function TopBar({
  pageTitle, user, selectedMonth, onMonthChange, onOpenPalette, onSignOut,
}: TopBarProps) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement | null>(null)

  // Detect Mac for keyboard hint
  const [isMac, setIsMac] = useState(true)
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/Mac/i.test(navigator.platform))
    }
  }, [])

  // Close profile menu on outside click
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
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-xl"
      style={{
        backgroundColor: "rgba(8,13,30,0.72)",
        borderBottomColor: "rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">

        {/* Brand */}
        <Link href="/dashboard" className="group flex items-center gap-2 shrink-0">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff6b6a] to-[#c42423] shadow-[0_0_16px_rgba(228,45,44,0.40)]">
            <span className="text-[11px] font-black text-white tracking-tight">GB</span>
          </div>
          <span className="hidden md:inline text-[14px] font-bold tracking-tight text-white group-hover:opacity-90">
            GovBidder
          </span>
        </Link>

        {/* Breadcrumb */}
        <div className="hidden md:flex items-center gap-1.5 text-[12px] min-w-0">
          <ChevronRight className="h-3 w-3 text-white/20 shrink-0" />
          {crumb && (
            <>
              <span className="text-white/40 shrink-0">{crumb}</span>
              <ChevronRight className="h-3 w-3 text-white/20 shrink-0" />
            </>
          )}
          <span className="font-semibold text-white truncate">{pageTitle}</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Command palette trigger (the star of the show) */}
        <button
          onClick={onOpenPalette}
          className="group flex items-center gap-2.5 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 transition-all hover:border-white/[0.14] hover:bg-white/[0.05] min-w-[200px] sm:min-w-[280px] max-w-[380px]"
        >
          <Search className="h-3.5 w-3.5 text-white/40 group-hover:text-white/60 transition-colors shrink-0" />
          <span className="flex-1 text-[12px] text-white/40 group-hover:text-white/65 transition-colors text-left">
            Buscar páginas, acciones…
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-white/[0.08] bg-black/20 px-1.5 py-0.5 text-[9px] font-semibold text-white/45 shrink-0">
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

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            className="group flex items-center gap-1.5 h-9 rounded-xl pl-1 pr-2 transition-all hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06]"
            onClick={() => setProfileOpen(v => !v)}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff6b6a] to-[#c42423] text-[10px] font-bold text-white shadow-sm">
              {initials}
            </span>
          </button>

          {profileOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl page-enter"
              style={{
                backgroundColor: "rgba(13,23,69,0.95)",
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              <div className="px-4 py-3.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff6b6a] to-[#c42423] text-sm font-bold text-white shadow-md">
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                    <p className="text-[11px] text-white/45 truncate">{user?.email}</p>
                  </div>
                </div>
                {user?.role === "admin" && (
                  <span className="mt-2.5 inline-flex items-center gap-1 rounded-full border border-[#E42D2C]/25 bg-[#E42D2C]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ff6b6a]">
                    ★ Admin
                  </span>
                )}
              </div>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-white/75 hover:bg-white/[0.04] hover:text-white transition-colors"
                onClick={() => { setProfileOpen(false); onSignOut() }}
              >
                <LogOut className="h-4 w-4 text-white/50" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
