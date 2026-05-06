"use client"

import { useEffect, useState } from "react"
import { Portal } from "@/components/ui/portal"
import {
  Sparkles, ArrowRight, ArrowLeft, X, ListTodo, Bell, Keyboard,
  FormInput, Activity, Users2, BarChart3, Check,
} from "lucide-react"

const ONBOARDING_KEY = "onboarding_completed_v1"

interface Step {
  icon:        any
  title:       string
  body:        string
  actionLabel?: string
  actionHref?:  string
}

const STEPS: Step[] = [
  {
    icon:  Sparkles,
    title: "Bienvenido a GovBidder",
    body:  "Tu dashboard interno para gestionar bids, leads, equipo y métricas. En 60 segundos te muestro lo esencial.",
  },
  {
    icon:  ListTodo,
    title: "Tareas estilo ClickUp",
    body:  "Board / Lista / Calendar. Drag&drop entre columnas, atajos (Q nueva, J/K navegar, ? ayuda), templates pre-armados, IA Extract para crear tareas desde un email.",
    actionLabel: "Ver Tareas",
    actionHref:  "/admin/tasks",
  },
  {
    icon:  Users2,
    title: "Personas Agendadas",
    body:  "Tu pipeline: cada lead que vas conociendo, su estado de venta, último contacto. Detecta automáticamente cuáles están sin seguimiento >7d.",
    actionLabel: "Ver Personas",
    actionHref:  "/admin/personas",
  },
  {
    icon:  Bell,
    title: "Notificaciones automáticas",
    body:  "Cuando te asignan una tarea o comentan algo tuyo, te aparece la campana en el topbar. Triggers automáticos en la DB, no se te escapa nada.",
  },
  {
    icon:  FormInput,
    title: "Forms públicos",
    body:  "Creás un form (URL pública), lo mandás al cliente, y cada submit crea una tarea automáticamente en tu board. Ideal para captar briefs sin Tally.",
    actionLabel: "Ver Forms",
    actionHref:  "/admin/forms",
  },
  {
    icon:  BarChart3,
    title: "Métricas + IA",
    body:  "Dashboard con KPIs, proyecciones y tendencias. Botón ✨ Generar standup en /inicio te resume las últimas 24h con Claude. Y hay un asistente flotante con todo el contexto del workspace.",
    actionLabel: "Ver Panel",
    actionHref:  "/dashboard",
  },
  {
    icon:  Keyboard,
    title: "Atajos para ir rápido",
    body:  "⌘K command palette, n nueva tarea, p nueva persona, g a personas, g t tareas, ? para ver todos los atajos. Estás listo.",
  },
]

export function OnboardingTour() {
  const [show, setShow]   = useState(false)
  const [step, setStep]   = useState(0)

  // Show on first mount if not completed
  useEffect(() => {
    if (typeof window === "undefined") return
    const completed = window.localStorage.getItem(ONBOARDING_KEY)
    if (!completed) {
      // Small delay so the dashboard renders first
      const id = setTimeout(() => setShow(true), 800)
      return () => clearTimeout(id)
    }
  }, [])

  const close = (markCompleted = true) => {
    if (markCompleted && typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_KEY, new Date().toISOString())
    }
    setShow(false)
  }

  if (!show) return null

  const current  = STEPS[step]
  const isFirst  = step === 0
  const isLast   = step === STEPS.length - 1
  const Icon     = current.icon

  return (
    <Portal>
      <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm" onClick={() => close(false)} />
      <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">

          {/* Decorative top */}
          <div className="relative h-1 bg-gradient-to-r from-[#E42D2C] to-[#1e3a8a]" />

          {/* Body */}
          <div className="p-7 space-y-4 relative">
            <button
              onClick={() => close()}
              className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E42D2C]/10 to-[#1e3a8a]/10 ring-1 ring-[#1e3a8a]/15">
                <Icon className="h-5 w-5 text-[#1e3a8a]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]/70">
                  Paso {step + 1} de {STEPS.length}
                </p>
                <h3 className="text-[18px] font-bold tracking-tight text-slate-900">
                  {current.title}
                </h3>
              </div>
            </div>

            <p className="text-[13.5px] leading-relaxed text-slate-600">
              {current.body}
            </p>

            {current.actionHref && current.actionLabel && (
              <a
                href={current.actionHref}
                className="inline-flex items-center gap-1.5 h-8 rounded-full border border-[#1e3a8a]/25 bg-[#1e3a8a]/[0.05] px-3 text-[11.5px] font-semibold text-[#1e3a8a] hover:border-[#1e3a8a]/40 hover:bg-[#1e3a8a]/[0.08] transition-colors"
              >
                {current.actionLabel}
                <ArrowRight className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-3">
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step
                      ? "w-5 bg-[#E42D2C]"
                      : i < step
                        ? "w-1.5 bg-[#1e3a8a]"
                        : "w-1.5 bg-slate-300"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {!isFirst && (
                <button
                  onClick={() => setStep(s => Math.max(0, s - 1))}
                  className="inline-flex items-center gap-1 h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11.5px] font-medium text-slate-600 hover:border-slate-300 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Atrás
                </button>
              )}
              {!isLast ? (
                <button
                  onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
                  className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-[#1e3a8a] px-3.5 text-[11.5px] font-bold text-white hover:bg-[#1e3a8a]/90 transition-colors"
                >
                  Siguiente
                  <ArrowRight className="h-3 w-3" />
                </button>
              ) : (
                <button
                  onClick={() => close()}
                  className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-[#E42D2C] px-3.5 text-[11.5px] font-bold text-white hover:bg-[#c42423] transition-colors"
                >
                  <Check className="h-3 w-3" />
                  Empezar a usar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}
