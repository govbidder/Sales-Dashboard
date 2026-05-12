"use client"

/**
 * Theme toggle para el topbar. Dropdown con 3 opciones:
 *   - Light  → fuerza tema claro
 *   - Dark   → fuerza tema oscuro
 *   - System → sigue la preferencia del OS (revierte el override)
 *
 * Usa el ThemeProvider custom de @/components/ui/theme-provider (que
 * agrega/saca la clase `.dark` en <html>).
 */

import { useEffect, useRef, useState } from "react"
import { Sun, Moon, Monitor, Check } from "lucide-react"
import { useTheme } from "@/components/ui/theme-provider"
import { cn } from "@/lib/utils"

type Theme = "light" | "dark" | "system"

const OPTIONS: Array<{ value: Theme; label: string; icon: any }> = [
  { value: "light",  label: "Claro",    icon: Sun     },
  { value: "dark",   label: "Oscuro",   icon: Moon    },
  { value: "system", label: "Sistema",  icon: Monitor },
]

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Icono del trigger: refleja el tema EFECTIVO (no la elección "system").
  // Así el usuario ve un sol o luna según lo que está mirando ahora.
  const TriggerIcon = resolvedTheme === "dark" ? Moon : Sun

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title={`Tema: ${OPTIONS.find(o => o.value === theme)?.label ?? "Sistema"}`}
        aria-label="Cambiar tema"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          "border border-border bg-card text-muted-foreground",
          "hover:text-foreground hover:border-foreground/20",
          "transition-all duration-200",
        )}
      >
        <TriggerIcon className="h-4 w-4 transition-transform duration-300" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-full mt-2 w-44 z-50",
            "rounded-xl border border-border bg-popover text-popover-foreground",
            "shadow-[0_12px_32px_rgba(15,23,42,0.12)]",
            "p-1 animate-in fade-in slide-in-from-top-1 duration-150",
          )}
        >
          {OPTIONS.map(opt => {
            const Icon = opt.icon
            const active = theme === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => { setTheme(opt.value); setOpen(false) }}
                className={cn(
                  "flex items-center w-full gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                  "transition-colors",
                  active
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{opt.label}</span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
