import Link from "next/link"
import { Compass, ArrowRight } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a8a]/15 ring-1 ring-[#1e3a8a]/25 mb-5">
          <Compass className="h-6 w-6 text-[#1e3a8a]" />
        </span>

        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1e3a8a] mb-2">
          404
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
          Esta pantalla no existe (o ya no)
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          La URL que intentaste abrir no existe. Puede que se haya movido o que
          tengas un link viejo.
        </p>

        <Link
          href="/inicio"
          className="inline-flex items-center gap-2 h-10 rounded-xl bg-[#E42D2C] px-4 text-[13px] font-bold text-white hover:bg-[#c42423] hover:shadow-[0_8px_24px_rgba(228,45,44,0.25)] transition-all"
        >
          Ir a Inicio
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
