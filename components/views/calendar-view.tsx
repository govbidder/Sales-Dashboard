import { Calendar } from "lucide-react"

export function CalendarView() {
  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#E42D2C]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-slate-600">Agenda</h1>
        </div>
        <p className="text-xs text-slate-400 ml-[18px]">
          Agenda y reuniones del equipo
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(228,45,44,0.05),transparent_55%)]" />
        <div className="relative flex flex-col items-center text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E42D2C]/10 ring-1 ring-[#E42D2C]/20">
            <Calendar className="h-5 w-5 text-[#E42D2C]" />
          </div>
          <div className="max-w-md space-y-2">
            <h2 className="text-base font-semibold text-slate-900">Próximamente</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Acá vas a poder ver la agenda del equipo: demos con leads, follow-ups
              programados, syncs internos y, eventualmente, integración con Calendly
              o Google Calendar.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
