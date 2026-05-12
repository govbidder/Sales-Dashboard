"use client"

/**
 * Root error boundary. Atrapa errors no manejados en cualquier ruta
 * que no tenga su propio `error.tsx`. Permite reset (retry) sin
 * recargar la página entera.
 *
 * Convención Next 15+: este componente recibe { error, reset } y vive
 * en el root de `app/`. Si una página específica quiere su propio
 * fallback, define su error.tsx en su carpeta.
 */

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Hook para enviar a Sentry / observabilidad en el futuro.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.error("[GlobalError]", error)
    }
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/30 mb-5">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
        </span>

        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
          Algo se rompió en esta pantalla
        </h1>
        <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
          No te preocupes — el resto del dashboard sigue funcionando.
          Podés reintentar o volver a Inicio.
        </p>
        {error.digest && (
          <p className="text-[11px] text-muted-foreground font-mono mt-3 opacity-60">
            ref: {error.digest}
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 h-10 rounded-xl bg-[#E42D2C] px-4 text-[13px] font-bold text-white hover:bg-[#c42423] hover:shadow-[0_8px_24px_rgba(228,45,44,0.25)] transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </button>
          <Link
            href="/inicio"
            className="inline-flex items-center gap-2 h-10 rounded-xl border border-border bg-card px-4 text-[13px] font-semibold text-foreground hover:border-foreground/20 transition-all"
          >
            <Home className="h-3.5 w-3.5" />
            Inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
