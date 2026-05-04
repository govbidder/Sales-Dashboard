"use client"

import { ShieldCheck } from "lucide-react"

export function AuditView() {
  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#E42D2C]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-white/70">Compliance Audit</h1>
        </div>
        <p className="text-xs text-white/30 ml-[18px]">
          Diagnóstico de capacidad para licitaciones de gobierno
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1745] p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(228,45,44,0.05),transparent_55%)]" />
        <div className="relative flex flex-col items-center text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E42D2C]/10 ring-1 ring-[#E42D2C]/20">
            <ShieldCheck className="h-5 w-5 text-[#E42D2C]" />
          </div>
          <div className="max-w-md space-y-2">
            <h2 className="text-base font-semibold text-white">Próximamente</h2>
            <p className="text-sm text-white/50 leading-relaxed">
              Acá vas a poder hacer un diagnóstico estratégico con IA sobre tu
              capacidad para licitaciones gov: registro SAM.gov, capability
              statement, NAICS coverage, past performance, certificaciones (8(a),
              HUBZone, WOSB) y compliance. Resultado generado por Claude.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
