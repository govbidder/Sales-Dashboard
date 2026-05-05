"use client"

import type React from "react"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { TopBar } from "@/components/layout/top-bar"
import { CommandPalette } from "@/components/layout/command-palette"
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
}

const SelectedMonthContext = createContext<string | null>(null)
export function useSelectedMonth() { return useContext(SelectedMonthContext) }

const ActiveClientContext = createContext<string | null>(null)
export function useActiveClient() { return useContext(ActiveClientContext) }

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])

  const [authChecked,    setAuthChecked]    = useState(false)
  const [currentUser,    setCurrentUser]    = useState<CurrentUser | null>(null)
  const [activeClientId, setActiveClientId] = useState<string | null>(null)
  const [selectedMonth,  setSelectedMonth]  = useState<string>("2025-12")
  const [paletteOpen,    setPaletteOpen]    = useState(false)

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

  // Cmd+K / Ctrl+K to open palette
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isPaletteShortcut =
        (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)
      if (isPaletteShortcut) {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

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
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: "#080d1e" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#E42D2C]" />
          <p className="text-xs text-white/30 tracking-widest uppercase">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-background">
      <NavigationProgress />

      <TopBar
        pageTitle={pageTitle}
        user={currentUser}
        selectedMonth={selectedMonth}
        onMonthChange={handleMonthChange}
        onOpenPalette={() => setPaletteOpen(true)}
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

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSignOut={handleSignOut}
      />
    </div>
  )
}
