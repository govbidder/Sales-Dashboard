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
  "/dashboard":                   "Panel",
  "/sales":                       "Ingresos",
  "/reflection":                  "Reflexión",
  "/metrics":                     "Métricas",
  "/audit":                       "Auditoría",
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

      {/* Floating Cmd+K hint (only on first visit) */}
      <FloatingHint />
    </div>
  )
}

// ─── First-time hint ──────────────────────────────────────────────────────────

function FloatingHint() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const seen = window.localStorage.getItem("cmdk-hint-seen")
    if (!seen) {
      const t = setTimeout(() => setShow(true), 1500)
      return () => clearTimeout(t)
    }
  }, [])

  const dismiss = () => {
    setShow(false)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("cmdk-hint-seen", "1")
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-sm">
      <div
        className="flex items-start gap-3 rounded-2xl border border-white/[0.10] bg-[#0d1745]/95 backdrop-blur-xl px-4 py-3 shadow-2xl page-enter"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E42D2C]/15 ring-1 ring-[#E42D2C]/30">
          <span className="text-[15px]">⌘</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white">Navegá con ⌘K</p>
          <p className="mt-0.5 text-[11px] text-white/55 leading-relaxed">
            Apretá <kbd className="rounded border border-white/[0.10] bg-white/[0.05] px-1 text-[10px] font-semibold">⌘K</kbd> (o <kbd className="rounded border border-white/[0.10] bg-white/[0.05] px-1 text-[10px] font-semibold">Ctrl K</kbd>) en cualquier momento para saltar a cualquier página o ejecutar una acción.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="text-white/30 hover:text-white/70 transition-colors text-[18px] leading-none"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
    </div>
  )
}
