"use client"

/**
 * Métricas Hub — la página unificada de /metrics.
 *
 * Tres tabs sobre una sola URL:
 *   ?tab=general    → MetricsView (radar, MoM, tendencias)
 *   ?tab=conversion → SalesView (embudo de conversión + tasa de cierre)
 *   ?tab=upload     → ReportsInputView (form de carga manual + CSV)
 *
 * El default es "general". El tab activo se persiste en query string para
 * que se pueda compartir un link al tab específico y para que F5 mantenga
 * el estado.
 */

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BarChart3, ArrowDownToLine, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { MetricsView } from "@/components/views/metrics-view"
import { SalesView } from "@/components/views/sales-view"
import { ReportsInputView } from "@/components/views/reports-input-view"

type TabKey = "general" | "conversion" | "upload"

const TABS: Array<{ key: TabKey; label: string; icon: any }> = [
  { key: "general",    label: "General",    icon: BarChart3      },
  { key: "conversion", label: "Conversión", icon: ArrowDownToLine },
  { key: "upload",     label: "Cargar",     icon: Upload         },
]

function isValidTab(v: string | null): v is TabKey {
  return v === "general" || v === "conversion" || v === "upload"
}

export function MetricsHubView() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const rawTab       = searchParams?.get("tab") ?? null
  const initialTab: TabKey = isValidTab(rawTab) ? rawTab : "general"

  // Tab state local; el URL es la fuente de verdad pero usamos local para
  // animaciones fluidas sin esperar a router.push.
  const [tab, setTab] = useState<TabKey>(initialTab)

  // Sync URL → local cuando cambia desde fuera (deep link, back button).
  useEffect(() => {
    if (isValidTab(rawTab) && rawTab !== tab) setTab(rawTab)
  }, [rawTab, tab])

  const handleTabChange = (next: TabKey) => {
    if (next === tab) return
    setTab(next)
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    if (next === "general") params.delete("tab")
    else params.set("tab", next)
    router.replace(`/metrics${params.toString() ? `?${params}` : ""}`, { scroll: false })
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
        {/* Gradient mesh decoration */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -right-32 h-[400px] w-[400px] rounded-full bg-[#1e3a8a]/[0.08] blur-[100px]" />
          <div className="absolute -bottom-24 -left-24 h-[300px] w-[300px] rounded-full bg-[#E42D2C]/[0.06] blur-[100px]" />
        </div>

        <div className="relative px-6 pt-6 pb-0 sm:px-7 sm:pt-7">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a8a]/15 ring-1 ring-[#1e3a8a]/30">
              <BarChart3 className="h-3.5 w-3.5 text-[#1e3a8a]" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#1e3a8a]">
              Performance
            </span>
          </div>
          <h1 className="text-[28px] sm:text-[36px] font-bold tracking-tight text-foreground leading-[1.05]">
            Métricas
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            KPIs, conversión y carga de reportes en un solo lugar. Cambiá de tab abajo.
          </p>

          {/* Tab bar */}
          <div className="mt-6 -mb-px flex gap-1 overflow-x-auto border-b border-border">
            {TABS.map(t => {
              const active = t.key === tab
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  onClick={() => handleTabChange(t.key)}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-3 text-[13px] font-semibold transition-colors",
                    "after:absolute after:left-3 after:right-3 after:-bottom-px after:h-[2px] after:rounded-full",
                    "after:transition-all after:duration-300",
                    active
                      ? "text-[#1e3a8a] after:bg-[#1e3a8a] after:shadow-[0_0_12px_rgba(30,58,138,0.40)]"
                      : "text-muted-foreground hover:text-foreground after:bg-transparent",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-[#1e3a8a]" : "text-muted-foreground")} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tab content with crossfade */}
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-300" key={tab}>
        {tab === "general"    && <MetricsView />}
        {tab === "conversion" && <SalesView />}
        {tab === "upload"     && <ReportsInputView />}
      </div>
    </div>
  )
}
