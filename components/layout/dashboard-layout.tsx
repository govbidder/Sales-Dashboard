"use client"

import type React from "react"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { ChevronDown, LogOut, Menu, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MonthSelector } from "@/components/layout/month-selector"
import { Sidebar } from "@/components/layout/sidebar"
import { AnnualMetricsProvider } from "@/contexts/annual-metrics-context"
import { NavigationProgress } from "@/components/ui/navigation-progress"

// ── Mock user — no external connections ───────────────────────────────────────
const MOCK_USER = {
  email: "demo@govbidder.com",
  role: "admin",
  clientId: "demo-client-001",
  name: "Demo Admin",
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Bid Dashboard",
  "/channels": "Bid Sources",
  "/sales": "Revenue",
  "/reflection": "Review",
  "/metrics": "All Metrics",
  "/audit": "Compliance Audit",
  "/program-checklist": "Implementation Checklist",
  "/market-intelligence": "Market Research",
  "/content-research": "Market Research",
  "/competitor-research": "Market Research",
  "/video-feed": "Training Videos",
  "/tools": "Tools",
  "/calendar": "Schedule",
  "/mi-dashboard": "Market Intelligence",
  "/monday-win": "Weekly Win",
  "/report-input": "Monthly Report",
  "/report-history": "Report History",
  "/chi-chang": "Revenue Track",
  "/transcript": "Video Transcripts",
  "/recursos":   "Resources",
  "/admin/data":         "Data Table",
  "/admin/leads":        "Prospects",
  "/admin/payments":     "Payments",
  "/admin/applications": "Applications",
  "/admin/clients":      "Clients",
}

const SelectedMonthContext = createContext<string | null>(null)
export function useSelectedMonth() { return useContext(SelectedMonthContext) }

const ActiveClientContext = createContext<string | null>(null)
export function useActiveClient() { return useContext(ActiveClientContext) }

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>("2025-12")
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname()
  const pageTitle = PAGE_TITLES[pathname] ?? "GovBidder Sales Dashboard"

  // Restore persisted month
  useEffect(() => {
    const stored = window.localStorage.getItem("selectedMonth")
    if (stored) setSelectedMonth(stored)
  }, [])

  // Close profile menu on outside click / Escape
  useEffect(() => {
    const onKey   = (e: KeyboardEvent) => { if (e.key === "Escape") setProfileMenuOpen(false) }
    const onMouse = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node))
        setProfileMenuOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onMouse)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onMouse)
    }
  }, [])

  return (
    <div className="flex h-screen overflow-hidden dark" style={{ backgroundColor: "#080d1e" }}>
      <NavigationProgress />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col lg:ml-[220px] h-full overflow-hidden" style={{ backgroundColor: "#080d1e" }}>
        <header className="shrink-0 z-10 border-b border-white/[0.08] backdrop-blur-md" style={{ backgroundColor: "rgba(8,13,30,0.95)" }}>
          <div className="flex h-16 items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden text-white/60 hover:text-white" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white leading-tight tracking-tight">{pageTitle}</h1>
                <p className="hidden sm:block text-[10px] text-white/35 leading-none mt-0.5 tracking-wide">GovBidder Sales Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button asChild size="sm" className="hidden sm:inline-flex bg-[#E42D2C] text-white font-semibold hover:bg-[#c42423] border-0 text-xs px-3 h-8" title="Weekly Win">
                <a href="/monday-win">Weekly Win</a>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex bg-[#E42D2C] text-white font-semibold hover:bg-[#c42423] border-0 text-xs px-3 h-8" title="Monthly Report">
                <a href="/report-input">Monthly Report</a>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex bg-[#152978] text-white font-semibold hover:bg-[#1a3494] border-0 text-xs px-3 h-8 gap-1.5" title="Revenue Track">
                <a href="/chi-chang"><span className="text-[13px]">📊</span>Revenue Track</a>
              </Button>

              <MonthSelector
                value={selectedMonth}
                onChange={(m) => {
                  setSelectedMonth(m)
                  if (typeof window !== "undefined") window.localStorage.setItem("selectedMonth", m)
                }}
                enabledMonths={[]}
              />

              <div className="relative" ref={profileMenuRef}>
                <Button
                  variant="outline"
                  className="gap-2 text-white hover:text-white border-white/20 hover:bg-white/10"
                  onClick={() => setProfileMenuOpen(v => !v)}
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#E42D2C]/40 bg-[#E42D2C]/10">
                    <User className="h-4 w-4 text-[#E42D2C]" />
                  </span>
                  <span className="hidden sm:inline text-white font-semibold">{MOCK_USER.name}</span>
                  <ChevronDown className="h-4 w-4 opacity-80 text-[#E42D2C]" />
                </Button>

                {profileMenuOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#0d1745]/95 text-white shadow-lg backdrop-blur">
                    <div className="px-3 py-2.5">
                      <p className="text-sm font-semibold text-white">{MOCK_USER.name}</p>
                      <p className="text-xs text-white/40">{MOCK_USER.email}</p>
                    </div>
                    <div className="h-px bg-white/10" />
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white/70 hover:bg-white/[0.06]"
                      onClick={() => { setProfileMenuOpen(false); window.location.href = "/login" }}
                    >
                      <LogOut className="h-4 w-4 text-[#E42D2C]" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <ActiveClientContext.Provider value={MOCK_USER.clientId}>
          <AnnualMetricsProvider>
            <SelectedMonthContext.Provider value={selectedMonth}>
              <main className="flex-1 overflow-y-auto p-4 lg:p-8" style={{ backgroundColor: "#080d1e" }}>{children}</main>
            </SelectedMonthContext.Provider>
          </AnnualMetricsProvider>
        </ActiveClientContext.Provider>
      </div>
    </div>
  )
}
