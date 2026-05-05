"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"
import { Portal } from "@/components/ui/portal"

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "info"

interface Toast {
  id:       string
  message:  string
  variant:  ToastVariant
  duration: number
}

interface ToastContextValue {
  show: (message: string, opts?: { variant?: ToastVariant; duration?: number }) => void
  success: (message: string, duration?: number) => void
  error:   (message: string, duration?: number) => void
  info:    (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Allow safe usage during SSR / when not wrapped — fail silently rather than crash.
    return {
      show: () => {}, success: () => {}, error: () => {}, info: () => {},
    }
  }
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const show = useCallback((message: string, opts?: { variant?: ToastVariant; duration?: number }) => {
    const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const t: Toast = {
      id,
      message,
      variant: opts?.variant ?? "info",
      duration: opts?.duration ?? 3500,
    }
    setToasts(prev => [...prev, t])
    if (t.duration > 0) {
      setTimeout(() => remove(id), t.duration)
    }
  }, [remove])

  const value: ToastContextValue = {
    show,
    success: (m, d) => show(m, { variant: "success", duration: d }),
    error:   (m, d) => show(m, { variant: "error",   duration: d ?? 5000 }),
    info:    (m, d) => show(m, { variant: "info",    duration: d }),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Portal>
        <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex flex-col gap-2 items-end">
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
          ))}
        </div>
      </Portal>
    </ToastContext.Provider>
  )
}

// ─── Toast item ───────────────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 10)
    return () => clearTimeout(t)
  }, [])

  const palette = {
    success: { icon: CheckCircle2, color: "text-emerald-700", ring: "ring-emerald-500/25", bg: "bg-emerald-500/[0.06]" },
    error:   { icon: AlertCircle,  color: "text-red-700",     ring: "ring-red-500/25",     bg: "bg-red-500/[0.06]"     },
    info:    { icon: Info,         color: "text-blue-700",    ring: "ring-blue-500/25",    bg: "bg-blue-500/[0.06]"    },
  }[toast.variant]

  const Icon = palette.icon

  return (
    <div
      className={`pointer-events-auto flex items-start gap-2.5 min-w-[260px] max-w-[380px] rounded-xl border border-slate-200 backdrop-blur-xl px-3.5 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.15)] ring-1 ${palette.ring} ${palette.bg} transition-all duration-300 ${
        open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
      style={{ backgroundColor: "rgba(255,255,255,0.95)" }}
      role="status"
    >
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${palette.color}`} />
      <p className="flex-1 text-[13px] text-slate-900 leading-snug">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors -mt-0.5"
        aria-label="Cerrar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
