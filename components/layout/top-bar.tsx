"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronDown, LogOut,
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
  "/tools":                 "Programa",
  "/recursos":              "Programa",
  "/calendar":              "Programa",
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
      className="sticky top-0 z-10 border-b backdrop-blur-xl"
      style={{
        backgroundColor: "rgba(8,13,30,0.72)",
        borderBottomColor: "rgba(255,255,255,0.05)",
      }}
    >
      <div className="grid h-14 items-center px-4 lg:px-6 grid-cols-[auto_1fr_auto] gap-3">

        {/* Left: Brand */}
        <Link href="/inicio" className="group flex items-center gap-2 shrink-0">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff6b6a] to-[#c42423] shadow-[0_0_16px_rgba(228,45,44,0.40)]">
            <span className="text-[11px] font-black text-white tracking-tight">GB</span>
          </div>
          <span className="hidden md:inline text-[14px] font-bold tracking-tight text-white group-hover:opacity-90">
            GovBidder
          </span>
        </Link>

        {/* Center: Page switcher (the centerpiece) */}
        <div className="flex items-center justify-center min-w-0">
          <button
            onClick={onOpenPalette}
            className="group flex items-center gap-2 h-10 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 transition-all hover:border-white/[0.18] hover:bg-white/[0.05] hover:shadow-[0_4px_20px_rgba(228,45,44,0.10)] max-w-full"
            title="Cambiar de página · ⌘K"
          >
            {crumb && (
              <>
                <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35 group-hover:text-white/55 transition-colors">
                  {crumb}
                </span>
                <span className="hidden sm:inline text-white/15">/</span>
              </>
            )}
            <span className="text-[14px] sm:text-[15px] font-semibold text-white truncate">
              {pageTitle}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-white/35 group-hover:text-white/70 transition-colors shrink-0" />
            <kbd className="hidden md:inline-flex items-center gap-0.5 rounded-md border border-white/[0.08] bg-black/20 px-1.5 py-0.5 text-[9px] font-semibold text-white/45 shrink-0 ml-1">
              {isMac ? "⌘" : "Ctrl"}K
            </kbd>
          </button>
        </div>

        {/* Right: Month + Profile */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:block">
            <MonthSelector
              value={selectedMonth}
              onChange={onMonthChange}
              enabledMonths={[]}
            />
          </div>

          <div className="relative" ref={profileRef}>
            <button
              className="group flex items-center h-9 rounded-xl pl-1 pr-1 transition-all hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06]"
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
      </div>
    </header>
  )
}
