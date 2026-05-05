"use client"

import type React from "react"
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown, LogOut, Menu, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MonthSelector } from "@/components/layout/month-selector"
import { Sidebar } from "@/components/layout/sidebar"
import { AnnualMetricsProvider } from "@/contexts/annual-metrics-context"
import { NavigationProgress } from "@/components/ui/navigation-progress"
import { createClient } from "@/lib/supabase"

type CurrentUser = {
  email: string
  name: string
  role: "admin" | "user"
  clientId: string
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":                   "Bid Dashboard",
  "/channels":                    "Bid Sources",
  "/sales":                       "Revenue",
  "/reflection":                  "Review",
  "/metrics":                     "All Metrics",
  "/audit":                       "Compliance Audit",
  "/program-checklist":           "Implementation",
  "/tools":                       "Tools",
  "/calendar":                    "Schedule",
  "/recursos":                    "Resources",
  "/admin/personas":              "Personas Agendadas",
  "/admin/tasks":                 "Tareas",
  "/admin/centro-operativo":      "Operations Center",
}

const SelectedMonthContext = createContext<string | null>(null)
export function useSelectedMonth() { return useContext(SelectedMonthContext) }

const ActiveClientContext = createContext<string | null>(null)
export function useActiveClient() { return useContext(ActiveClientContext) }

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])

  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [activeClientId, setActiveClientId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>("2025-12")
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  const pageTitle = PAGE_TITLES[pathname] ?? "GovBidder"

  // Auth check + subscribe to changes
  useEffect(() => {
    let mounted = true

    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace("/login")
        return
      }

      const user = session.user
      let name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Usuario"
      let role: "admin" | "user" = "user"
      let clientId = user.id

      // Try to fetch profile for role / name
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, full_name, client_id")
          .eq("id", user.id)
          .single()

        if (profile) {
          if (profile.role === "admin") role = "admin"
          if (profile.full_name) name = profile.full_name
          if (profile.client_id) clientId = profile.client_id
        }
      } catch {
        // profiles table may not exist yet — use metadata fallbacks
      }

      if (!mounted) return

      setCurrentUser({ email: user.email ?? "", name, role, clientId })
      setActiveClientId(clientId)
      setAuthChecked(true)
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.replace("/login")
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, router])

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

  async function handleSignOut() {
    setProfileMenuOpen(false)
    await supabase.auth.signOut()
    router.replace("/login")
  }

  // Show loading screen while checking auth
  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: "#080d1e" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#E42D2C]" />
          <p className="text-xs text-white/30 tracking-widest uppercase">Cargando...</p>
        </div>
      </div>
    )
  }

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
                <p className="hidden sm:block text-[10px] text-white/35 leading-none mt-0.5 tracking-wide">GovBidder · Internal Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
                  <span className="hidden sm:inline text-white font-semibold">{currentUser?.name}</span>
                  <ChevronDown className="h-4 w-4 opacity-80 text-[#E42D2C]" />
                </Button>

                {profileMenuOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#0d1745]/95 text-white shadow-lg backdrop-blur">
                    <div className="px-3 py-2.5">
                      <p className="text-sm font-semibold text-white">{currentUser?.name}</p>
                      <p className="text-xs text-white/40">{currentUser?.email}</p>
                      {currentUser?.role === "admin" && (
                        <span className="mt-1 inline-block rounded-full bg-[#E42D2C]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#E42D2C]">Admin</span>
                      )}
                    </div>
                    <div className="h-px bg-white/10" />
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white/70 hover:bg-white/[0.06]"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4 text-[#E42D2C]" />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <ActiveClientContext.Provider value={activeClientId}>
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
