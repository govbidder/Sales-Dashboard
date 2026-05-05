"use client"

import { useMemo } from "react"
import { useMonthlyReports } from "@/hooks/use-monthly-reports"
import { useSelectedMonth } from "@/components/layout/dashboard-layout"
import { Wallet, Megaphone, Cpu, TrendingDown, Percent } from "lucide-react"

function fmtMoney(v: any) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  const n = Number(v)
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 10_000)    return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function Profitability() {
  const { reports } = useMonthlyReports()
  const ctxMonth = useSelectedMonth()
  const target = (ctxMonth ?? "").slice(0, 7)

  const stats = useMemo(() => {
    if (!reports.length) return null
    const sorted = [...reports].sort((a, b) => a.month.localeCompare(b.month))
    const current = sorted.find(r => r.month === target) ?? sorted[sorted.length - 1]
    if (!current) return null

    const prevIdx = sorted.findIndex(r => r.month === current.month) - 1
    const previous = prevIdx >= 0 ? sorted[prevIdx] : null

    const compute = (r: any) => {
      const rev   = Number(r.total_revenue)  || 0
      const cash  = Number(r.cash_collected) || 0
      const ad    = Number(r.ad_spend)       || 0
      const sw    = Number(r.software_costs) || 0
      const vc    = Number(r.variable_costs) || 0
      const totalCosts = ad + sw + vc
      const profit     = rev - totalCosts
      const margin     = rev > 0 ? (profit / rev) * 100 : null
      return { rev, cash, ad, sw, vc, totalCosts, profit, margin }
    }

    const cur = compute(current)
    const prev = previous ? compute(previous) : null

    const deltaProfit = prev ? cur.profit - prev.profit : null
    const deltaMargin = prev && prev.margin != null && cur.margin != null ? cur.margin - prev.margin : null

    return { cur, prev, deltaProfit, deltaMargin, monthLabel: current.month }
  }, [reports, target])

  if (!stats) {
    return (
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">Rentabilidad</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">
            Revenue menos costos · margen · breakdown de gastos
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-400">Cargá métricas para ver la rentabilidad.</p>
        </div>
      </section>
    )
  }

  const { cur, prev, deltaProfit, deltaMargin } = stats
  const profitColor = cur.profit >= 0 ? "text-emerald-700" : "text-red-700"
  const profitIsUp  = deltaProfit != null && deltaProfit > 0

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Rentabilidad</h2>
        <p className="text-[13px] text-slate-400 mt-0.5">
          Revenue menos costos · margen · breakdown de gastos
        </p>
      </div>

      {/* Top row: profit + margin */}
      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">Beneficio neto</p>
              <p className={`mt-1.5 text-3xl font-bold tracking-tight tabular-nums ${profitColor}`}>
                {fmtMoney(cur.profit)}
              </p>
              <p className="mt-1 text-[12px] text-slate-400">
                Revenue {fmtMoney(cur.rev)} − Costos {fmtMoney(cur.totalCosts)}
              </p>
            </div>
            {prev && deltaProfit != null && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                profitIsUp ? "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20"
                           : "bg-red-500/10 text-red-700 ring-1 ring-red-500/20"
              }`}>
                {profitIsUp ? "+" : ""}{fmtMoney(deltaProfit)}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">Margen</p>
              <p className="mt-1.5 text-3xl font-bold tracking-tight tabular-nums text-slate-900">
                {cur.margin != null ? `${cur.margin.toFixed(1)}%` : "—"}
              </p>
              <p className="mt-1 text-[12px] text-slate-400">
                {cur.margin != null && cur.margin >= 50 ? "Alto" :
                 cur.margin != null && cur.margin >= 25 ? "Saludable" :
                 cur.margin != null && cur.margin >= 0  ? "Apretado" :
                 cur.margin != null                     ? "Negativo" : "Sin datos"}
              </p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/25">
              <Percent className="h-4 w-4 text-emerald-700" />
            </span>
          </div>
          {deltaMargin != null && (
            <p className={`mt-2 text-[11px] ${deltaMargin >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {deltaMargin >= 0 ? "+" : ""}{deltaMargin.toFixed(1)}pp vs mes anterior
            </p>
          )}
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-[#E42D2C]" />
          <h3 className="text-[12px] font-bold uppercase tracking-widest text-slate-600">
            Breakdown de costos
          </h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { key: "ad", label: "Publicidad",     icon: Megaphone, color: "#fb923c" },
            { key: "sw", label: "Software",       icon: Cpu,       color: "#60a5fa" },
            { key: "vc", label: "Variables",      icon: Wallet,    color: "#ff6b6a" },
          ].map(c => {
            const v = (cur as any)[c.key] as number
            const pct = cur.totalCosts > 0 ? (v / cur.totalCosts) * 100 : 0
            const Icon = c.icon
            return (
              <div key={c.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${c.color}15`, boxShadow: `0 0 0 1px ${c.color}25` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: c.color }} />
                  </span>
                  <span className="text-[10px] font-bold tabular-nums text-slate-500">{pct.toFixed(0)}%</span>
                </div>
                <p className="text-lg font-bold tracking-tight text-slate-900 tabular-nums">{fmtMoney(v)}</p>
                <p className="text-[11px] text-slate-500">{c.label}</p>
                <div className="mt-2 h-1 w-full rounded-full bg-slate-50 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
