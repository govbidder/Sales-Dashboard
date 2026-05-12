"use client"

/**
 * Banner sticky en el top del dashboard cuando hay View-As activo.
 * Solo se renderiza para developers con viewAs distinto de null.
 *
 * Color ámbar intencional — no usa theme vars porque el objetivo es
 * que NO se confunda con la app real. Es una señal de "estás simulando".
 */

import { Eye, X } from "lucide-react"
import { useViewAs } from "@/lib/contexts/view-as-context"
import { ROLE_LABEL } from "@/lib/types/role"

export function ViewAsBanner() {
  const { viewAsRole, clearViewAs, isViewing } = useViewAs()

  if (!isViewing || !viewAsRole) return null

  return (
    <div className="sticky top-0 z-[60] w-full bg-amber-400 text-amber-950 shadow-[0_2px_8px_rgba(180,83,9,0.25)]">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-4 w-4 shrink-0" />
          <p className="text-[13px] font-semibold truncate">
            Viendo como <span className="font-bold underline underline-offset-2">{ROLE_LABEL[viewAsRole]}</span>
            <span className="ml-2 hidden sm:inline text-[12px] font-medium text-amber-950/80">
              · Esto es solo visual — el servidor sigue tratándote como Developer.
            </span>
          </p>
        </div>
        <button
          onClick={clearViewAs}
          className="flex items-center gap-1.5 rounded-lg bg-amber-950/15 px-2.5 py-1 text-[12px] font-bold text-amber-950 hover:bg-amber-950/25 transition-all shrink-0"
        >
          <X className="h-3.5 w-3.5" />
          Volver a Developer
        </button>
      </div>
    </div>
  )
}
