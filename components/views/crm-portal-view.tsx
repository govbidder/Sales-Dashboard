"use client"

/**
 * CRM Portal — la "puerta de Narnia" del dashboard.
 *
 * Es una vista separada del DashboardLayout principal — vive en su propia
 * ruta /crm con su propio layout (app/crm/layout.tsx). Esto le da identidad
 * propia y refuerza la sensación de "otro mundo".
 *
 * Estado inicial: placeholder en desarrollo. Cada feature en su card con
 * tratamiento premium y badge "Próximamente". Cuando arme las features
 * reales, las cards se reemplazan in-place sin tocar la estructura.
 */

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import {
  ArrowLeft, Users, MessageSquare, TrendingUp, Sparkles,
  CircleDot, Clock,
} from "lucide-react"

interface FeatureCard {
  icon:        any
  title:       string
  description: string
  /** Estado del roadmap. */
  status:      "next" | "soon" | "later"
}

const FEATURES: FeatureCard[] = [
  {
    icon:        Users,
    title:       "Clientes activos",
    description: "Lista de cuentas con plan vigente, MRR, próximas renovaciones y health score por cliente.",
    status:      "next",
  },
  {
    icon:        MessageSquare,
    title:       "Conversaciones",
    description: "Hilos por cliente con historial unificado de WhatsApp, email y notas internas del equipo.",
    status:      "soon",
  },
  {
    icon:        TrendingUp,
    title:       "Forecasting",
    description: "Proyección de revenue con escenarios optimista, base y pesimista basados en el pipeline real.",
    status:      "later",
  },
  {
    icon:        Sparkles,
    title:       "AI insights",
    description: "Detecta cuentas en riesgo, oportunidades de upsell y patrones de churn antes que pasen.",
    status:      "later",
  },
]

const STATUS_LABEL: Record<FeatureCard["status"], string> = {
  next:  "Próximo",
  soon:  "En breve",
  later: "Más adelante",
}

const STATUS_STYLES: Record<FeatureCard["status"], string> = {
  next:  "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  soon:  "border-amber-500/30 bg-amber-500/10 text-amber-300",
  later: "border-slate-500/30 bg-slate-500/10 text-muted-foreground/70",
}

export function CrmPortalView() {
  const router = useRouter()

  // ESC vuelve al dashboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/inicio")
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [router])

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0e1c] text-slate-100 animate-in fade-in duration-500">
      {/* Background mesh — gradientes que respiran */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[#1e3a8a]/25 blur-[140px]" />
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-[#E42D2C]/15 blur-[160px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-[#1e3a8a]/20 blur-[120px] animate-pulse" style={{ animationDuration: "8s" }} />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative max-w-[1100px] mx-auto px-6 py-12 sm:px-10 sm:py-16">
        {/* Top bar: back link */}
        <div className="flex items-center justify-between mb-10">
          <Link
            href="/inicio"
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[12px] font-semibold text-muted-foreground/70 hover:bg-white/[0.08] hover:border-white/20 hover:text-white transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Volver al dashboard
            <kbd className="ml-1 hidden sm:inline-flex items-center gap-0.5 rounded border border-white/15 bg-white/[0.06] px-1.5 text-[10px] font-mono text-muted-foreground">
              ESC
            </kbd>
          </Link>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            <CircleDot className="h-2 w-2 animate-pulse" />
            En desarrollo
          </span>
        </div>

        {/* Hero */}
        <div className="mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-5">
            <Sparkles className="h-3 w-3 text-[#E42D2C]" />
            GovBidder
          </div>
          <h1 className="text-[56px] sm:text-[80px] font-bold leading-[0.95] tracking-tight bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            CRM
          </h1>
          <p className="mt-4 text-[15px] sm:text-[17px] text-muted-foreground max-w-[640px] leading-relaxed">
            Clientes activos, conversaciones, pipeline y forecasting de revenue. Un módulo entero dentro del dashboard,
            con su propia identidad. Lo estamos construyendo — esto es la puerta.
          </p>
        </div>

        {/* Features grid */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Roadmap
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-white/15 to-transparent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.06] cursor-not-allowed"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-[#1e3a8a]/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative flex items-start justify-between gap-4 mb-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10 text-slate-200 group-hover:bg-white/[0.10] group-hover:ring-white/20 transition-all">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[f.status]}`}
                    >
                      <Clock className="h-2.5 w-2.5" />
                      {STATUS_LABEL[f.status]}
                    </span>
                  </div>

                  <h3 className="relative text-[18px] font-bold text-slate-100 mb-2 tracking-tight">
                    {f.title}
                  </h3>
                  <p className="relative text-[13px] text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer note */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-4 text-[12px] text-muted-foreground leading-relaxed">
          Cuando una feature esté lista, su card pasa de "Próximamente" a interactiva sin tocar la estructura del módulo.
          Si querés priorizar una específica, avisanos.
        </div>
      </div>
    </main>
  )
}
