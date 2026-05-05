"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, LogOut } from "lucide-react"
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
    <header
      className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur-xl"
    >
      <div className="grid h-16 items-center px-4 lg:px-6 grid-cols-[auto_1fr_auto] gap-3">

        {/* Left: Brand */}
        <Link href="/inicio" className="group flex items-center shrink-0 hover:opacity-90 transition-opacity">
          <Image
            src="/govbidder-logo.png"
            alt="GovBidder"
            width={160}
            height={48}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>

        {/* Center: Page switcher pill */}
        <div className="flex items-center justify-center min-w-0">
          <button
            onClick={onOpenPalette}
            className="group flex items-center gap-2 h-10 rounded-full border border-slate-200 bg-white px-4 transition-all hover:border-[#E42D2C]/30 hover:shadow-[0_2px_12px_rgba(228,45,44,0.10)] max-w-full"
            title="Cambiar de página · ⌘K"
          >
            {crumb && (
              <>
                <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 group-hover:text-slate-700 transition-colors">
                  {crumb}
                </span>
                <span className="hidden sm:inline text-slate-300">/</span>
              </>
            )}
            <span className="text-[14px] sm:text-[15px] font-semibold text-slate-900 truncate">
              {pageTitle}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
            <kbd className="hidden md:inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 shrink-0 ml-1">
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
              className="group flex items-center h-10 rounded-full pl-1 pr-1 transition-all hover:bg-slate-100"
              onClick={() => setProfileOpen(v => !v)}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E42D2C] text-[11px] font-bold text-white shadow-sm">
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
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E42D2C] text-sm font-bold text-white">
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                  {user?.role === "admin" && (
                    <span className="mt-2.5 inline-flex items-center gap-1 rounded-full border border-[#E42D2C]/20 bg-[#E42D2C]/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#E42D2C]">
                      ★ Admin
                    </span>
                  )}
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
      </div>
    </header>
  )
}
