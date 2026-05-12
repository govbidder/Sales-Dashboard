"use client"

import { useMemo } from "react"
import { useMonthlyReports } from "@/hooks/use-monthly-reports"
import { useSelectedMonth } from "@/components/layout/dashboard-layout"
import { TrendingUp, Target, History, CalendarRange } from "lucide-react"
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from "recharts"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  const n = Number(v)
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 10_000)    return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function fmtMonth(m: string) {
  const [y, mm] = m.split("-")
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  return `${names[parseInt(mm, 10) - 1]} '${y.slice(2)}`
}

// Simple linear regression: y = a*x + b on the latest N points
function linearForecast(values: number[], stepsAhead: number) {
  if (values.length < 2) return Array(stepsAhead).fill(values.length === 1 ? values[0] : 0)

  const n = values.length
  const xs = Array.from({ length: n }, (_, i) => i)
  const meanX = (n - 1) / 2
  const meanY = values.reduce((s, v) => s + v, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = meanY - slope * meanX
  return Array.from({ length: stepsAhead }, (_, k) => Math.max(0, slope * (n + k) + intercept))
}

function shiftMonth(ymd: string, months: number) {
  // ymd may be "YYYY-MM" or "YYYY-MM-DD"
  const [y, mm] = ymd.slice(0, 7).split("-").map(Number)
  const d = new Date(Date.UTC(y, mm - 1 + months, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPI({
  label, value, icon: Icon, accent, hint,
}: {
  label: string
  value: string
  icon: any
  accent: string
  hint?: string | null
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}15`, boxShadow: `0 0 0 1px ${accent}25` }}>
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Projections() {
  const { reports } = useMonthlyReports()
  const ctxMonth = useSelectedMonth()
  const targetMonth = (ctxMonth ?? "").slice(0, 7)

  const data = useMemo(() => {
    if (!reports.length) return null

    // Use up to 12 months of history ending at the latest available data
    const sorted = [...reports].sort((a, b) => a.month.localeCompare(b.month))
    const tail = sorted.slice(-12)
    const lastMonth = sorted[sorted.length - 1]?.month
    if (!lastMonth) return null

    const cashHistory    = tail.map(r => Number(r.cash_collected) || 0)
    const revenueHistory = tail.map(r => Number(r.total_revenue)  || 0)
    const mrrHistory     = tail.map(r => Number(r.mrr)            || 0)

    // 3-month forecast (linear regression)
    const cashForecast    = linearForecast(cashHistory, 3)
    const revenueForecast = linearForecast(revenueHistory, 3)
    const mrrForecast     = linearForecast(mrrHistory, 3)

    // Build chart points: history (actual) + forecast (dashed)
    const chartPoints = tail.map((r, i) => ({
      month:    fmtMonth(r.month.slice(0, 7)),
      revenue:  Number(r.total_revenue) || 0,
      cash:     Number(r.cash_collected) || 0,
      mrr:      Number(r.mrr) || 0,
      forecast: false as boolean | undefined,
    }))
    for (let i = 0; i < 3; i++) {
      chartPoints.push({
        month:    fmtMonth(shiftMonth(lastMonth, i + 1)),
        revenue:  Math.round(revenueForecast[i]),
        cash:     Math.round(cashForecast[i]),
        mrr:      Math.round(mrrForecast[i]),
        forecast: true,
      })
    }

    // Annualized pace based on current selected month (or latest)
    const target = sorted.find(r => r.month.slice(0, 7) === targetMonth) ?? sorted[sorted.length - 1]
    const annualizedRevenue = (Number(target?.total_revenue)  || 0) * 12
    const annualizedCash    = (Number(target?.cash_collected) || 0) * 12

    // YoY comparison
    const sameLastYear = sorted.find(r => r.month.slice(0, 7) === shiftMonth(target?.month ?? lastMonth, -12))
    const yoyRevenue = sameLastYear ? {
      current:   Number(target?.total_revenue) || 0,
      previous:  Number(sameLastYear.total_revenue) || 0,
    } : null
    const yoyPct = yoyRevenue && yoyRevenue.previous > 0
      ? ((yoyRevenue.current - yoyRevenue.previous) / yoyRevenue.previous) * 100
      : null

    // Forecast totals (next 3 months)
    const next3RevTotal  = revenueForecast.reduce((s, v) => s + v, 0)
    const next3CashTotal = cashForecast.reduce((s, v) => s + v, 0)

    return {
      chartPoints,
      annualizedRevenue,
      annualizedCash,
      yoyPct,
      yoyRevenue,
      next3RevTotal,
      next3CashTotal,
      lastMonth: lastMonth.slice(0, 7),
      monthsAvailable: tail.length,
    }
  }, [reports, targetMonth])

  if (!data || data.monthsAvailable < 2) {
    return (
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground">Proyecciones</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Forecast lineal sobre los últimos meses · pace anual · YoY
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Necesitamos al menos 2 meses de datos para generar proyecciones.
            Cargá métricas en <span className="text-foreground">Cargar Métricas</span>.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Proyecciones</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Forecast lineal sobre los últimos {data.monthsAvailable} meses · pace anual · YoY
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
        <KPI
          label="Próximos 3 meses (Revenue)"
          value={fmtMoney(data.next3RevTotal)}
          icon={Target}
          accent="#E42D2C"
          hint="Forecast lineal"
        />
        <KPI
          label="Próximos 3 meses (Cash)"
          value={fmtMoney(data.next3CashTotal)}
          icon={Target}
          accent="#fb923c"
          hint="Forecast lineal"
        />
        <KPI
          label="Pace Anual (Revenue)"
          value={fmtMoney(data.annualizedRevenue)}
          icon={CalendarRange}
          accent="#60a5fa"
          hint={`Si se mantiene el ritmo de ${fmtMonth(data.lastMonth)} × 12`}
        />
        <KPI
          label="YoY Revenue"
          value={data.yoyPct != null ? `${data.yoyPct > 0 ? "+" : ""}${data.yoyPct.toFixed(0)}%` : "—"}
          icon={History}
          accent={data.yoyPct != null && data.yoyPct >= 0 ? "#4ade80" : "#f87171"}
          hint={data.yoyRevenue
            ? `${fmtMoney(data.yoyRevenue.current)} vs ${fmtMoney(data.yoyRevenue.previous)} año pasado`
            : "Necesitamos histórico de 12+ meses"}
        />
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#E42D2C]" />
          <h3 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
            Revenue · Cash · MRR — histórico + forecast 3 meses
          </h3>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.chartPoints} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="g_rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#E42D2C" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#E42D2C" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => fmtMoney(Number(v))}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
                labelStyle={{ color: "#0f172a", fontWeight: 700, fontSize: 12 }}
                itemStyle={{ fontSize: 12 }}
                formatter={(value: any) => fmtMoney(Number(value))}
              />
              {/* Vertical line where forecast starts */}
              <ReferenceLine
                x={fmtMonth(data.lastMonth)}
                stroke="rgba(228,45,44,0.4)"
                strokeDasharray="4 4"
                label={{ value: "Hoy", fill: "rgba(228,45,44,0.6)", fontSize: 10, position: "top" }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#E42D2C"
                strokeWidth={2}
                fill="url(#g_rev)"
                name="Ingresos"
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="cash"
                stroke="#fb923c"
                strokeWidth={1.8}
                name="Cobrado"
                dot={{ r: 2.5 }}
              />
              <Line
                type="monotone"
                dataKey="mrr"
                stroke="#60a5fa"
                strokeWidth={1.5}
                name="MRR"
                dot={{ r: 2 }}
                strokeDasharray="2 2"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground text-center">
          Línea punteada vertical = mes actual · A partir de ahí, datos proyectados (regresión lineal sobre histórico)
        </p>
      </div>
    </section>
  )
}
