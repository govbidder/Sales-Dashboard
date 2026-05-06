"use client"

import type React from "react"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { TopBar } from "@/components/layout/top-bar"
import { Sidebar } from "@/components/layout/sidebar"
import { CommandPalette } from "@/components/layout/command-palette"
import { OnboardingTour } from "@/components/onboarding/onboarding-tour"
import { AnnualMetricsProvider } from "@/contexts/annual-metrics-context"
import { NavigationProgress } from "@/components/ui/navigation-progress"
import { ToastProvider } from "@/components/ui/toast"
import { AIAssistant } from "@/components/ai/ai-assistant"
import { createClient } from "@/lib/supabase"

type CurrentUser = {
  email: string
  name: string
  role: "admin" | "user"
  clientId: string
}

const PAGE_TITLES: Record<string, string> = {
  "/inicio":                      "Página Principal",
  "/dashboard":                   "Panel",
  "/sales":                       "Ingresos",
  "/metrics":                     "Métricas",
  "/tools":                       "Herramientas",
  "/calendar":                    "Agenda",
  "/recursos":                    "Recursos",
  "/admin/personas":              "Personas Agendadas",
  "/admin/tasks":                 "Tareas",
  "/admin/team":                  "Equipo",
  "/admin/reports":               "Cargar Métricas",
  "/admin/centro-operativo":      "Centro Operativo",
  "/admin/activity":               "Actividad",
  "/admin/forms":                  "Forms públicos",
  "/admin/task-templates":         "Templates de tareas",
  "/admin/audit-log":              "Audit log",
}

const SelectedMonthContext = createContext<string | null>(null)
export function useSelectedMonth() { return useContext(SelectedMonthContext) }

const ActiveClientContext = createContext<string | null>(null)
export function useActiveClient() { return useContext(ActiveClientContext) }

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])

  const [authChecked,       setAuthChecked]       = useState(false)
  const [currentUser,       setCurrentUser]       = useState<CurrentUser | null>(null)
  const [activeClientId,    setActiveClientId]    = useState<string | null>(null)
  const [selectedMonth,     setSelectedMonth]     = useState<string>("2025-12")
  const [paletteOpen,       setPaletteOpen]       = useState(false)
  const [sidebarOpen,       setSidebarOpen]       = useState(false)
  const [sidebarCollapsed,  setSidebarCollapsed]  = useState(false)

  const pageTitle = PAGE_TITLES[pathname] ?? "GovBidder"

  // Auth check
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

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, full_name, client_id")
          .eq("id", user.id)
          .single()

        if (profile) {
          if (profile.role === "admin") role = "admin"
          if (profile.full_name)        name = profile.full_name
          if (profile.client_id)        clientId = profile.client_id
        }
      } catch { /* fallback to metadata */ }

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

  // Restore persisted sidebar collapsed state
  useEffect(() => {
    const stored = window.localStorage.getItem("sidebarCollapsed")
    if (stored === "1") setSidebarCollapsed(true)
  }, [])

  // Close mobile sidebar when route changes
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const handleToggleCollapse = () => {
    setSidebarCollapsed(v => {
      const next = !v
      if (typeof window !== "undefined") {
        window.localStorage.setItem("sidebarCollapsed", next ? "1" : "0")
      }
      return next
    })
  }

  // Global keyboard shortcuts
  useEffect(() => {
    let leaderTimer: ReturnType<typeof setTimeout> | null = null
    let waitingForLeader = false

    function isInsideEditable(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName.toLowerCase()
      return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable
    }

    function onKey(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K — open palette
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }

      // Skip single-letter shortcuts when typing in inputs
      if (isInsideEditable(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // Single-letter create shortcuts
      if (e.key === "n") {
        e.preventDefault()
        router.push("/admin/tasks?new=1")
        return
      }
      if (e.key === "p") {
        e.preventDefault()
        router.push("/admin/personas?new=1")
        return
      }

      // "g X" leader sequence — go to <X>
      if (waitingForLeader) {
        if (leaderTimer) clearTimeout(leaderTimer)
        waitingForLeader = false
        const k = e.key.toLowerCase()
        const map: Record<string, string> = {
          i: "/inicio",
          d: "/dashboard",
          s: "/sales",
          m: "/metrics",
          r: "/admin/reports",
          a: "/admin/personas",  // a for "agendadas"
          t: "/admin/tasks",
          e: "/admin/team",      // e for "equipo"
          o: "/admin/centro-operativo",  // o for "operativo"
        }
        if (map[k]) {
          e.preventDefault()
          router.push(map[k])
        }
        return
      }
      if (e.key === "g") {
        e.preventDefault()
        waitingForLeader = true
        leaderTimer = setTimeout(() => { waitingForLeader = false }, 1000)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      if (leaderTimer) clearTimeout(leaderTimer)
    }
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const handleMonthChange = (m: string) => {
    setSelectedMonth(m)
    if (typeof window !== "undefined") window.localStorage.setItem("selectedMonth", m)
  }

  // Loading state
  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#E42D2C]" />
          <p className="text-xs text-slate-500 tracking-widest uppercase">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <ToastProvider>
    <div className="min-h-screen bg-background">
      <NavigationProgress />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <div
        className={
          "flex min-h-screen flex-col transition-[margin] duration-300 ease-out " +
          (sidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[240px]")
        }
      >
        <TopBar
          pageTitle={pageTitle}
          user={currentUser}
          selectedMonth={selectedMonth}
          onMonthChange={handleMonthChange}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenSidebar={() => setSidebarOpen(true)}
          onSignOut={handleSignOut}
        />

        <ActiveClientContext.Provider value={activeClientId}>
          <AnnualMetricsProvider>
            <SelectedMonthContext.Provider value={selectedMonth}>
              <main className="flex-1 ambient-bg">
                <div className="p-4 lg:p-8 max-w-[1600px] mx-auto page-enter">
                  {children}
                </div>
              </main>
            </SelectedMonthContext.Provider>
          </AnnualMetricsProvider>
        </ActiveClientContext.Provider>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSignOut={handleSignOut}
      />

      <AIAssistant selectedMonth={selectedMonth} />

      <OnboardingTour />
    </div>
    </ToastProvider>
  )
}
