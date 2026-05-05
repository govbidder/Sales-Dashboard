"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import {
  Loader2, AlertCircle, AlertTriangle, CheckCircle2, RefreshCw,
  Calendar as CalIcon, Users2, ListTodo, FileBarChart, TrendingDown,
  TrendingUp, Activity, ArrowRight, Flag,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverdueTask {
  id:         string
  title:      string
  priority:   "baja" | "media" | "alta" | "urgente"
  owner:      string | null
  assignees:  string[]
  due_at:     string
  persona_id: string | null
}

interface StalePersona {
  id:           string
  name:         string
  scheduled_at: string | null
  call_status:  string
  sales_status: string
  owner:        string | null
  last_contact: string
}

interface MetricChange {
  key:      string
  label:    string
  current:  number
  previous: number
  pct:      number
  format:   "money" | "number"
}

interface HealthData {
  issuesCount: number
  counts: {
    overdueTasks:     number
    pendingTasks:     number
    stalePersonas:    number
    activePersonas:   number
    teamMembers:      number
    decliningMetrics: number
    improvingMetrics: number
  }
  overdueTasks:         OverdueTask[]
  stalePersonas:        StalePersona[]
  missingCurrentReport: boolean
  currentMonth:         string
  previousMonth:        string
  declining:            MetricChange[]
  improving:            MetricChange[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1)   return "ahora"
  if (min < 60)  return `hace ${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24)   return `hace ${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7)   return `hace ${day} días`
  const wk = Math.floor(day / 7)
  if (wk < 4)    return `hace ${wk} sem`
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

function fmtMoney(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toLocaleString()}`
}

function fmtNumber(n: number) {
  return n.toLocaleString()
}

function fmtMonthLabel(m: string) {
  const [y, mm] = m.split("-")
  const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
  return `${names[parseInt(mm, 10) - 1]} ${y}`
}

const PRIORITY_FLAG: Record<string, string> = {
  baja:    "text-zinc-400",
  media:   "text-amber-300",
  alta:    "text-orange-300",
  urgente: "text-red-300",
}

// ─── Issue Card primitive ─────────────────────────────────────────────────────

function IssueCard({
  icon: Icon, title, count, href, accent, children,
}: {
  icon: any
  title: string
  count: number
  href?: string
  accent: "red" | "amber" | "blue"
  children?: React.ReactNode
}) {
  const ringClass =
    accent === "red"   ? "ring-red-500/20    bg-red-500/[0.04]"   :
    accent === "amber" ? "ring-amber-500/20  bg-amber-500/[0.04]" :
                         "ring-blue-500/20   bg-blue-500/[0.04]"
  const accentColor =
    accent === "red"   ? "#f87171" :
    accent === "amber" ? "#fbbf24" :
                         "#60a5fa"

  return (
    <div className={`rounded-2xl ring-1 ${ringClass} bg-[#0d1745] overflow-hidden`}>
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl ring-1"
            style={{ backgroundColor: `${accentColor}15`, boxShadow: `0 0 0 1px ${accentColor}30` }}
          >
            <Icon className="h-4 w-4" style={{ color: accentColor }} />
          </span>
          <div>
            <h3 className="text-[14px] font-bold text-white leading-none">{title}</h3>
            <p className="text-[11px] text-white/40 mt-1">
              {count} {count === 1 ? "ítem" : "ítems"}
            </p>
          </div>
        </div>
        {href && count > 0 && (
          <Link
            href={href}
            className="flex items-center gap-1 text-[11px] font-semibold text-white/55 hover:text-white transition-colors"
          >
            Ver todo
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Inicio View ──────────────────────────────────────────────────────────────

export function InicioView() {
  const [data,    setData]    = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch("/api/admin/health", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        setError("No pude cargar el estado del dashboard.")
        return
      }
      setData(await res.json())
    } catch (e: any) {
      setError(e?.message ?? "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchHealth() }, [fetchHealth])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-red-400 mb-2" />
        <p className="text-sm text-red-300">{error ?? "Sin datos"}</p>
        <button onClick={fetchHealth} className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-[12px] font-semibold text-red-300 hover:bg-red-500/20">
          Reintentar
        </button>
      </div>
    )
  }

  const { issuesCount, counts, overdueTasks, stalePersonas, missingCurrentReport,
          currentMonth, declining, improving } = data

  const allClear = issuesCount === 0
  const heroAccent = allClear ? "emerald" : issuesCount > 5 ? "red" : "amber"

  return (
    <div className="space-y-6">

      {/* HERO BANNER ──────────────────────────────────────────────────────── */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-6 sm:p-8 ${
          heroAccent === "emerald" ? "border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-[#0d1745] to-[#0d1745]" :
          heroAccent === "red"     ? "border-red-500/20     bg-gradient-to-br from-red-500/[0.08]     via-[#0d1745] to-[#0d1745]" :
                                     "border-amber-500/20   bg-gradient-to-br from-amber-500/[0.06]   via-[#0d1745] to-[#0d1745]"
        }`}
      >
        <div className="pointer-events-none absolute -top-20 -right-20 h-[300px] w-[300px] rounded-full blur-[100px]"
          style={{ backgroundColor: heroAccent === "emerald" ? "rgba(16,185,129,0.10)" : heroAccent === "red" ? "rgba(248,113,113,0.10)" : "rgba(251,191,36,0.10)" }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl ring-1 ${
                heroAccent === "emerald" ? "bg-emerald-500/15 ring-emerald-500/30" :
                heroAccent === "red"     ? "bg-red-500/15     ring-red-500/30"     :
                                           "bg-amber-500/15   ring-amber-500/30"
              }`}>
                {heroAccent === "emerald" ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> :
                 heroAccent === "red"     ? <AlertCircle  className="h-4 w-4 text-red-300"     /> :
                                            <AlertTriangle className="h-4 w-4 text-amber-300"  />}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">
                Estado del Dashboard
              </span>
            </div>
            <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-white leading-tight">
              {allClear
                ? "Todo en orden"
                : issuesCount === 1
                ? "1 ítem requiere atención"
                : `${issuesCount} ítems requieren atención`}
            </h1>
            <p className="text-sm text-white/50 mt-2">
              {allClear
                ? "Sin tareas vencidas, métricas al día, equipo activo."
                : "Revisá los puntos críticos abajo para mantener el dashboard saludable."}
            </p>
          </div>

          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-2 h-10 rounded-xl border border-white/[0.10] bg-white/[0.05] px-4 text-[13px] font-semibold text-white/85 hover:bg-white/[0.08] transition-all disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>

        {/* Quick stats row */}
        <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Tareas vencidas",      val: counts.overdueTasks,      tone: counts.overdueTasks > 0 ? "red" : "neutral" },
            { label: "Sin seguimiento",      val: counts.stalePersonas,     tone: counts.stalePersonas > 0 ? "amber" : "neutral" },
            { label: "Personas activas",     val: counts.activePersonas,    tone: "neutral" },
            { label: "Equipo",               val: counts.teamMembers,       tone: "neutral" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <p className={`text-2xl font-bold tabular-nums ${
                s.tone === "red" ? "text-red-300" : s.tone === "amber" ? "text-amber-300" : "text-white"
              }`}>
                {s.val}
              </p>
              <p className="text-[11px] text-white/45 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ALERTS GRID ──────────────────────────────────────────────────────── */}
      {(overdueTasks.length > 0 || stalePersonas.length > 0 || missingCurrentReport || declining.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">

          {/* Overdue tasks */}
          {overdueTasks.length > 0 && (
            <IssueCard icon={ListTodo} title="Tareas vencidas" count={overdueTasks.length} href="/admin/tasks" accent="red">
              <div className="divide-y divide-white/[0.04]">
                {overdueTasks.slice(0, 6).map(t => (
                  <Link
                    key={t.id}
                    href="/admin/tasks"
                    className="group flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <Flag className={`h-3.5 w-3.5 shrink-0 ${PRIORITY_FLAG[t.priority]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white/90 truncate">{t.title}</p>
                      <p className="text-[11px] text-red-300/80 mt-0.5">
                        Venció {fmtRelative(t.due_at)}
                        {t.owner && <span className="text-white/35"> · {t.owner}</span>}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/55 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                ))}
                {overdueTasks.length > 6 && (
                  <Link href="/admin/tasks" className="flex items-center justify-center gap-1.5 px-5 py-3 text-[12px] font-semibold text-white/55 hover:text-white transition-colors">
                    Ver las {overdueTasks.length - 6} restantes
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </IssueCard>
          )}

          {/* Stale personas */}
          {stalePersonas.length > 0 && (
            <IssueCard icon={Users2} title="Personas sin seguimiento" count={stalePersonas.length} href="/admin/personas" accent="amber">
              <div className="divide-y divide-white/[0.04]">
                {stalePersonas.slice(0, 6).map(p => (
                  <Link
                    key={p.id}
                    href="/admin/personas"
                    className="group flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff6b6a] to-[#c42423] text-[10px] font-bold text-white shadow-sm shrink-0">
                      {(p.name ?? "?").split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white/90 truncate">{p.name}</p>
                      <p className="text-[11px] text-amber-300/80 mt-0.5">
                        Último contacto {fmtRelative(p.last_contact)}
                        {p.owner && <span className="text-white/35"> · {p.owner}</span>}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/55 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                ))}
              </div>
            </IssueCard>
          )}

          {/* Missing current month report */}
          {missingCurrentReport && (
            <IssueCard icon={FileBarChart} title="Métricas del mes" count={1} href="/admin/reports" accent="blue">
              <div className="px-5 py-4">
                <p className="text-[13px] text-white/75 leading-relaxed">
                  No hay reporte cargado para <span className="font-semibold text-white">{fmtMonthLabel(currentMonth)}</span>. Sin datos del mes actual, los KPIs y proyecciones quedan ciegos.
                </p>
                <Link
                  href="/admin/reports"
                  className="mt-3 inline-flex items-center gap-2 h-9 rounded-xl bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] transition-colors"
                >
                  <FileBarChart className="h-3.5 w-3.5" />
                  Cargar Métricas
                </Link>
              </div>
            </IssueCard>
          )}

          {/* Declining metrics */}
          {declining.length > 0 && (
            <IssueCard icon={TrendingDown} title="Métricas en caída" count={declining.length} href="/dashboard" accent="red">
              <div className="divide-y divide-white/[0.04]">
                {declining.map(m => (
                  <div key={m.key} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-white/90 truncate">{m.label}</p>
                      <p className="text-[11px] text-white/45 mt-0.5">
                        {m.format === "money" ? fmtMoney(m.previous) : fmtNumber(m.previous)} → {m.format === "money" ? fmtMoney(m.current) : fmtNumber(m.current)}
                      </p>
                    </div>
                    <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold tabular-nums text-red-300">
                      {m.pct.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </IssueCard>
          )}
        </div>
      )}

      {/* IMPROVEMENTS / WHAT'S GOOD ───────────────────────────────────────── */}
      {improving.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.05]">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
                <TrendingUp className="h-4 w-4 text-emerald-300" />
              </span>
              <div>
                <h3 className="text-[14px] font-bold text-white leading-none">Lo que está mejorando</h3>
                <p className="text-[11px] text-white/40 mt-1">{improving.length} {improving.length === 1 ? "métrica" : "métricas"} al alza</p>
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.04]">
            {improving.map(m => (
              <div key={m.key} className="bg-[#0d1745] px-5 py-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-white/85">{m.label}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {m.format === "money" ? fmtMoney(m.current) : fmtNumber(m.current)}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-300">
                  +{m.pct.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUICK NAV ────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0d1745] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-white/40" />
          <h3 className="text-[12px] font-bold uppercase tracking-widest text-white/55">Atajos</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: "/dashboard",       label: "Panel",              icon: TrendingUp },
            { href: "/admin/personas",  label: "Personas Agendadas", icon: Users2     },
            { href: "/admin/tasks",     label: "Tareas",             icon: ListTodo   },
            { href: "/admin/reports",   label: "Cargar Métricas",    icon: FileBarChart },
          ].map(s => {
            const Icon = s.icon
            return (
              <Link
                key={s.href}
                href={s.href}
                className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04] px-3.5 py-3 transition-all"
              >
                <Icon className="h-4 w-4 text-white/45 group-hover:text-[#ff6b6a] transition-colors" />
                <span className="flex-1 text-[12px] font-semibold text-white/85 group-hover:text-white">{s.label}</span>
                <ArrowRight className="h-3 w-3 text-white/20 group-hover:text-white/65 group-hover:translate-x-0.5 transition-all" />
              </Link>
            )
          })}
        </div>
      </div>

    </div>
  )
}
