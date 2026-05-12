"use client"

/**
 * Error boundary scope: /admin/*.
 *
 * Atrapa errors específicos de pantallas admin (tasks, personas,
 * team, departments, etc.) sin tirar el dashboard entero. Mantiene
 * el chrome del DashboardLayout si fuese posible — pero al ser un
 * error boundary de Next, queda en el segmento.
 */

import { useEffect } from "react"
import Link from "next/link"
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.error("[AdminError]", error)
    }
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#E42D2C]/15 ring-1 ring-[#E42D2C]/25 mb-4">
          <AlertCircle className="h-5 w-5 text-[#E42D2C]" />
        </span>

        <h2 className="text-lg font-bold tracking-tight text-foreground mb-1">
          No se pudo cargar esta sección
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Algo falló al traer la data o renderizar la vista. El resto del dashboard
          sigue funcionando.
        </p>
        {error.digest && (
          <p className="text-[11px] text-muted-foreground font-mono mt-3 opacity-60">
            ref: {error.digest}
          </p>
        )}

        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#E42D2C] px-3.5 text-[12.5px] font-bold text-white hover:bg-[#c42423] transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </button>
          <Link
            href="/inicio"
            className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-border bg-card px-3.5 text-[12.5px] font-semibold text-foreground hover:border-foreground/20 transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a Inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
