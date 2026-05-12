"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { AiStandupModal } from "@/components/views/inicio/ai-standup-modal"
import {
  Loader2, AlertCircle, AlertTriangle, CheckCircle2, RefreshCw,
  Users2, ListTodo, FileBarChart, TrendingDown, TrendingUp,
  Activity, ArrowRight, Flag, Sparkles, BarChart3, Target,
  Sun, Calendar as CalIcon, Layers,
} from "lucide-react"
import type { Department } from "@/lib/types/department"

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
  baja:    "text-zinc-600",
  media:   "text-amber-700",
  alta:    "text-orange-700",
  urgente: "text-red-700",
}

// ─── Stat Tile (top-row counters) ─────────────────────────────────────────────

function StatTile({
  label, value, icon: Icon, accent,
}: {
  label: string
  value: number | string
  icon:  any
  accent: "red" | "amber" | "blue" | "emerald" | "neutral"
}) {
  const palette = {
    red:     { ring: "ring-red-500/25",     icon: "bg-red-500/15     text-red-700",     glow: "rgba(248,113,113,0.10)" },
    amber:   { ring: "ring-amber-500/25",   icon: "bg-amber-500/15   text-amber-700",   glow: "rgba(251,191,36,0.10)"  },
    blue:    { ring: "ring-blue-500/25",    icon: "bg-blue-500/15    text-blue-700",    glow: "rgba(96,165,250,0.10)"  },
    emerald: { ring: "ring-emerald-500/25", icon: "bg-emerald-500/15 text-emerald-700", glow: "rgba(16,185,129,0.10)"  },
    neutral: { ring: "ring-slate-200",   icon: "bg-slate-100   text-slate-600",    glow: "rgba(15,23,42,0.05)" },
  }[accent]

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ring-1 ${palette.ring} bg-white/70 backdrop-blur-sm p-4`}
    >
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl"
        style={{ backgroundColor: palette.glow }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[28px] font-bold tabular-nums text-slate-900 leading-none">{value}</p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${palette.icon}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  )
}

// ─── Issue Section ─────────────────────────────────────────────────────────────

function IssueSection({
  icon: Icon, title, count, href, accent, severity, children,
}: {
  icon: any
  title: string
  count: number
  href?: string
  accent: "red" | "amber" | "navy"
  severity?: "high" | "medium" | "low"
  children?: React.ReactNode
}) {
  const palette = {
    red:   { headerBg: "bg-[#E42D2C]/[0.04]",  border: "border-[#E42D2C]/15", iconBg: "bg-[#E42D2C]/12 ring-[#E42D2C]/25", iconColor: "text-[#E42D2C]",   pillBg: "bg-[#E42D2C]/10 text-[#E42D2C] border-[#E42D2C]/25" },
    amber: { headerBg: "bg-amber-500/[0.05]",  border: "border-amber-500/20", iconBg: "bg-amber-500/12 ring-amber-500/25", iconColor: "text-amber-700",  pillBg: "bg-amber-500/10 text-amber-700 border-amber-500/25" },
    navy:  { headerBg: "bg-[#1e3a8a]/[0.04]",  border: "border-[#1e3a8a]/15", iconBg: "bg-[#1e3a8a]/12 ring-[#1e3a8a]/25", iconColor: "text-[#1e3a8a]",  pillBg: "bg-[#1e3a8a]/10 text-[#1e3a8a] border-[#1e3a8a]/25" },
  }[accent]

  const pulseDot = severity === "high"

  return (
    <div className={`overflow-hidden rounded-2xl border ${palette.border} bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}>
      <div className={`flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 ${palette.headerBg}`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${palette.iconBg}`}>
            <Icon className={`h-4 w-4 ${palette.iconColor}`} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-slate-900 leading-none truncate">{title}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums uppercase tracking-wider ${palette.pillBg}`}>
                {pulseDot && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-70 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                  </span>
                )}
                {count} {count === 1 ? "ítem" : "ítems"}
              </span>
            </div>
          </div>
        </div>
        {href && count > 0 && (
          <Link
            href={href}
            className="group flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-[#1e3a8a]/30 hover:text-[#1e3a8a] transition-colors"
          >
            Ver todo
            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Inicio View ──────────────────────────────────────────────────────────────

interface MyDayTask {
  id:        string
  title:     string
  status:    string
  priority:  string
  due_at:    string | null
  overdue:   boolean
}

interface DeptStat { pending: number; overdue: number; members: number }

export function InicioView() {
  const [data,         setData]         = useState<HealthData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [myDay,        setMyDay]        = useState<MyDayTask[]>([])
  const [currentEmail, setCurrentEmail] = useState<string>("")
  const [showStandup,  setShowStandup]  = useState(false)
  const [departments,  setDepartments]  = useState<Department[]>([])
  const [deptStats,    setDeptStats]    = useState<Record<string, DeptStat>>({})

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentEmail(session.user?.email ?? "")
      const res = await fetch("/api/admin/health", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        setError("No pude cargar el estado del dashboard.")
        return
      }
      setData(await res.json())

      // Fetch in parallel: tasks (top-level only) + departments + team for the widget below.
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const [tasksRes, deptRes, teamRes] = await Promise.all([
        fetch("/api/admin/tasks?include_subtasks=false", { headers }),
        fetch("/api/departments",                        { headers }),
        fetch("/api/admin/team",                         { headers }),
      ])

      let allTasks: any[] = []
      if (tasksRes.ok) {
        const tasksJ = await tasksRes.json()
        allTasks = tasksJ.tasks ?? []
        const myEmail = session.user?.email ?? ""
        const now = Date.now()
        const endOfToday = new Date()
        endOfToday.setHours(23, 59, 59, 999)
        const mine = allTasks
          .filter(t => myEmail && (t.assignees ?? []).includes(myEmail))
          .filter(t => t.status !== "completada" && t.status !== "cancelada")
          .filter(t => {
            if (!t.due_at) return false
            const due = new Date(t.due_at).getTime()
            return due <= endOfToday.getTime()
          })
          .map(t => ({
            id: t.id, title: t.title, status: t.status, priority: t.priority, due_at: t.due_at,
            overdue: t.due_at && new Date(t.due_at).getTime() < now,
          }))
          .sort((a, b) => {
            if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
            return (a.due_at ?? "").localeCompare(b.due_at ?? "")
          })
        setMyDay(mine)
      }

      // Departments overview (vista de comando para Cristian/Santo).
      let depts: Department[] = []
      if (deptRes.ok) {
        const j = await deptRes.json()
        depts = j.departments ?? []
        setDepartments(depts)
      }

      let members: { department_id: string | null }[] = []
      if (teamRes.ok) {
        const j = await teamRes.json()
        members = j.members ?? []
      }

      // Tasks pending = no terminales + tienen department_id; overdue = due_at < ahora.
      // Members = profiles con department_id.
      const TERMINAL = new Set(["completada", "cancelada"])
      const now = Date.now()
      const stats: Record<string, DeptStat> = {}
      for (const d of depts) stats[d.id] = { pending: 0, overdue: 0, members: 0 }
      for (const t of allTasks) {
        if (!t.department_id || !stats[t.department_id]) continue
        if (TERMINAL.has(t.status)) continue
        stats[t.department_id].pending += 1
        if (t.due_at && new Date(t.due_at).getTime() < now) {
          stats[t.department_id].overdue += 1
        }
      }
      for (const m of members) {
        if (m.department_id && stats[m.department_id]) {
          stats[m.department_id].members += 1
        }
      }
      setDeptStats(stats)
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
        <AlertCircle className="mx-auto h-6 w-6 text-red-600 mb-2" />
        <p className="text-sm text-red-700">{error ?? "Sin datos"}</p>
        <button onClick={fetchHealth} className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-[12px] font-semibold text-red-700 hover:bg-red-500/20">
          Reintentar
        </button>
      </div>
    )
  }

  const { issuesCount, counts, overdueTasks, stalePersonas, missingCurrentReport,
          currentMonth, declining, improving } = data

  const allClear  = issuesCount === 0
  const heroState = allClear ? "good" : issuesCount > 5 ? "critical" : "warning"

  // Health score: rough proxy 0-100 based on issues count
  const healthScore = Math.max(0, Math.min(100, 100 - issuesCount * 10))
  const scoreColor =
    healthScore >= 80 ? "text-emerald-700" :
    healthScore >= 50 ? "text-amber-700" :
                        "text-red-700"
  const ringColor =
    healthScore >= 80 ? "stroke-emerald-400" :
    healthScore >= 50 ? "stroke-amber-400" :
                        "stroke-red-400"
  const ringBgColor =
    healthScore >= 80 ? "stroke-emerald-500/15" :
    healthScore >= 50 ? "stroke-amber-500/15" :
                        "stroke-red-500/15"

  // Circumference for SVG progress ring (r=42)
  const circumference = 2 * Math.PI * 42
  const offset = circumference * (1 - healthScore / 100)

  return (
    <div className="space-y-6">

      {showStandup && <AiStandupModal onClose={() => setShowStandup(false)} />}

      {/* HERO ─────────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-[#1e3a8a]/30 bg-white dark:bg-[#0d1745]"
        style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 16px 40px -16px rgba(15,23,42,0.10)" }}
      >
        {/* Ambient glow background — más sutil */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full blur-[100px]"
            style={{
              backgroundColor:
                heroState === "good"     ? "rgba(16,185,129,0.07)" :
                heroState === "critical" ? "rgba(228,45,44,0.10)"  :
                                           "rgba(251,191,36,0.07)",
            }}
          />
          <div
            className="absolute -bottom-32 -left-32 h-[380px] w-[380px] rounded-full blur-[120px]"
            style={{ backgroundColor: "rgba(30,58,138,0.07)" }}
          />
          {/* Grid pattern muy sutil */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(15,23,42,1) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,1) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="relative grid lg:grid-cols-[1fr_auto] gap-8 p-7 sm:p-9 items-center">

          {/* LEFT — title + message */}
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-4 rounded-full border border-slate-200/80 bg-white/70 backdrop-blur-sm pl-1.5 pr-3 py-1">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${
                heroState === "good"     ? "bg-emerald-500/15" :
                heroState === "critical" ? "bg-[#E42D2C]/15"   :
                                           "bg-amber-500/15"
              }`}>
                {heroState === "good"     ? <CheckCircle2  className="h-3 w-3 text-emerald-700" /> :
                 heroState === "critical" ? <AlertCircle   className="h-3 w-3 text-[#E42D2C]"   /> :
                                            <AlertTriangle className="h-3 w-3 text-amber-700"  />}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.20em] text-[#1e3a8a]">
                Estado del Dashboard
              </span>
            </div>

            <h1 className="text-[30px] sm:text-[38px] font-bold tracking-tight text-slate-900 leading-[1.08]">
              {allClear ? (
                <>Todo en orden.</>
              ) : (
                <>
                  <span className={heroState === "critical" ? "text-[#E42D2C]" : "text-amber-600"}>
                    {issuesCount}
                  </span>{" "}
                  <span className="text-slate-900">{issuesCount === 1 ? "ítem requiere" : "ítems requieren"}</span>
                  <br className="hidden sm:block" />
                  <span className="text-slate-500 font-semibold"> tu atención.</span>
                </>
              )}
            </h1>

            <p className="text-[13.5px] text-slate-500 mt-3 max-w-xl leading-relaxed">
              {allClear
                ? "Sin tareas vencidas, métricas al día, equipo activo. Buen trabajo."
                : "Revisá los puntos críticos abajo para mantener el dashboard saludable."}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowStandup(true)}
                className="inline-flex items-center gap-2 h-9 rounded-full border border-[#1e3a8a]/25 bg-gradient-to-br from-[#E42D2C]/[0.05] to-[#1e3a8a]/[0.05] px-3.5 text-[12px] font-bold text-[#1e3a8a] hover:border-[#1e3a8a]/40 hover:from-[#E42D2C]/[0.08] hover:to-[#1e3a8a]/[0.08] hover:shadow-[0_2px_8px_rgba(30,58,138,0.10)] transition-all"
                title="Generar resumen de las últimas 24h con IA"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generar standup
              </button>
              <button
                onClick={fetchHealth}
                disabled={loading}
                className="inline-flex items-center gap-2 h-9 rounded-full border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 hover:border-[#1e3a8a]/30 hover:text-[#1e3a8a] hover:shadow-[0_2px_8px_rgba(30,58,138,0.10)] transition-all disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Actualizar estado
              </button>
            </div>
          </div>

          {/* RIGHT — health ring */}
          <div className="flex items-center justify-center lg:justify-end">
            <div className="relative">
              <svg width="148" height="148" viewBox="0 0 100 100" className="-rotate-90 drop-shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
                <circle cx="50" cy="50" r="42" strokeWidth="6" fill="none" className={ringBgColor} />
                <circle
                  cx="50" cy="50" r="42"
                  strokeWidth="6"
                  fill="none"
                  className={ringColor}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 800ms cubic-bezier(0.22,1,0.36,1)" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className={`text-[36px] font-bold tabular-nums leading-none ${scoreColor}`}>
                  {healthScore}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-[0.20em] text-slate-400 mt-1.5">
                  Salud
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* STATS STRIP at bottom of hero */}
        <div className="relative border-t border-slate-100 bg-slate-50/40 grid grid-cols-2 sm:grid-cols-4">
          {[
            { label: "Tareas vencidas",  val: counts.overdueTasks,      icon: ListTodo, accent: counts.overdueTasks > 0 ? "red" as const : "neutral" as const },
            { label: "Sin seguimiento",  val: counts.stalePersonas,     icon: Users2,   accent: counts.stalePersonas > 0 ? "amber" as const : "neutral" as const },
            { label: "Personas activas", val: counts.activePersonas,    icon: Target,   accent: "navy" as const },
            { label: "Equipo",           val: counts.teamMembers,       icon: Users2,   accent: "navy" as const },
          ].map((s, i) => {
            const StatIcon = s.icon
            const accentText =
              s.accent === "red"   ? "text-[#E42D2C]" :
              s.accent === "amber" ? "text-amber-700" :
              s.accent === "navy"  ? "text-[#1e3a8a]" :
              "text-slate-900"
            const dotColor =
              s.accent === "red"   ? "bg-[#E42D2C]" :
              s.accent === "amber" ? "bg-amber-500" :
              s.accent === "navy"  ? "bg-[#1e3a8a]" :
              "bg-slate-300"
            return (
              <div
                key={s.label}
                className={`relative px-5 py-4 ${i < 3 ? "sm:border-r border-slate-200/70" : ""} ${i < 2 ? "border-b sm:border-b-0 border-slate-200/70" : ""}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                  <StatIcon className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {s.label}
                  </span>
                </div>
                <p className={`text-[24px] font-bold tabular-nums leading-none ${accentText}`}>
                  {s.val}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* DEPARTAMENTOS — vista de comando: cada depto con tasks + miembros */}
      {departments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Layers className="h-3.5 w-3.5 text-[#1e3a8a]" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">
              Departamentos
            </h2>
            <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600 tabular-nums">
              {departments.length}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {departments.map(d => {
              const s = deptStats[d.id] ?? { pending: 0, overdue: 0, members: 0 }
              return (
                <Link
                  key={d.id}
                  href={`/admin/tasks?department=${d.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-[0_0_24px_rgba(15,23,42,0.04)]"
                >
                  {/* Top accent bar with department color */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ backgroundColor: d.color }}
                  />

                  <div className="flex items-center gap-2 mb-3">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <h3 className="text-[13px] font-bold text-slate-900 truncate flex-1">{d.name}</h3>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#1e3a8a] group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[26px] font-bold tabular-nums leading-none text-slate-900">
                        {s.pending}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {s.pending === 1 ? "tarea pendiente" : "tareas pendientes"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {s.overdue > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-[#E42D2C]">
                          <AlertCircle className="h-2.5 w-2.5" />
                          {s.overdue} venc{s.overdue === 1 ? "ida" : "idas"}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500" title="Miembros asignados al departamento">
                        <Users2 className="h-3 w-3" /> {s.members}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* MI DÍA ───────────────────────────────────────────────────────────── */}
      {currentEmail && myDay.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">
              Mi día
            </h2>
            <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600 tabular-nums">
              {myDay.length}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="divide-y divide-slate-100">
              {myDay.slice(0, 6).map(t => (
                <Link
                  key={t.id}
                  href="/admin/tasks"
                  className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <span className={`shrink-0 h-2 w-2 rounded-full ${
                    t.priority === "urgente" ? "bg-[#E42D2C]" :
                    t.priority === "alta"    ? "bg-orange-500" :
                    t.priority === "media"   ? "bg-amber-500" :
                                                "bg-slate-300"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-900 truncate">{t.title}</p>
                    {t.due_at && (
                      <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${t.overdue ? "text-[#E42D2C] font-semibold" : "text-slate-400"}`}>
                        {t.overdue ? <AlertCircle className="h-3 w-3" /> : <CalIcon className="h-3 w-3" />}
                        {t.overdue ? "Vencida " : "Vence "}
                        {new Date(t.due_at).toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                  <Flag className={`h-3 w-3 shrink-0 ${
                    t.priority === "urgente" ? "text-[#E42D2C]" :
                    t.priority === "alta"    ? "text-orange-600" :
                    t.priority === "media"   ? "text-amber-600" :
                                                "text-slate-400"
                  }`} />
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#1e3a8a] group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
              {myDay.length > 6 && (
                <Link
                  href="/admin/tasks"
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-[11px] font-semibold text-slate-500 hover:text-[#1e3a8a] transition-colors hover:bg-slate-50"
                >
                  Ver las {myDay.length - 6} restantes
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ALERTS GRID ──────────────────────────────────────────────────────── */}
      {(overdueTasks.length > 0 || stalePersonas.length > 0 || missingCurrentReport || declining.length > 0) ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <AlertCircle className="h-3.5 w-3.5 text-red-700/80" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">
              Requieren Atención
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">

            {/* Overdue tasks */}
            {overdueTasks.length > 0 && (
              <IssueSection
                icon={ListTodo}
                title="Tareas vencidas"
                count={overdueTasks.length}
                href="/admin/tasks"
                accent="red"
                severity={overdueTasks.length > 3 ? "high" : "medium"}
              >
                <div className="divide-y divide-slate-100">
                  {overdueTasks.slice(0, 5).map(t => (
                    <Link
                      key={t.id}
                      href="/admin/tasks"
                      className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <Flag className={`h-3.5 w-3.5 shrink-0 ${PRIORITY_FLAG[t.priority]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{t.title}</p>
                        <p className="text-[11px] text-red-700/80 mt-0.5">
                          Venció {fmtRelative(t.due_at)}
                          {t.owner && <span className="text-slate-400"> · {t.owner}</span>}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  ))}
                  {overdueTasks.length > 5 && (
                    <Link href="/admin/tasks" className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-[11px] font-semibold text-slate-500 hover:text-slate-900 transition-colors hover:bg-slate-50">
                      + {overdueTasks.length - 5} más
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </IssueSection>
            )}

            {/* Stale personas */}
            {stalePersonas.length > 0 && (
              <IssueSection
                icon={Users2}
                title="Personas sin seguimiento"
                count={stalePersonas.length}
                href="/admin/personas"
                accent="amber"
                severity={stalePersonas.length > 3 ? "high" : "medium"}
              >
                <div className="divide-y divide-slate-100">
                  {stalePersonas.slice(0, 5).map(p => (
                    <Link
                      key={p.id}
                      href="/admin/personas"
                      className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff6b6a] to-[#c42423] text-[10px] font-bold text-white shadow-sm shrink-0">
                        {(p.name ?? "?").split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{p.name}</p>
                        <p className="text-[11px] text-amber-700/80 mt-0.5">
                          Último contacto {fmtRelative(p.last_contact)}
                          {p.owner && <span className="text-slate-400"> · {p.owner}</span>}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  ))}
                </div>
              </IssueSection>
            )}

            {/* Missing current month report */}
            {missingCurrentReport && (
              <IssueSection
                icon={FileBarChart}
                title="Métricas del mes"
                count={1}
                href="/admin/reports"
                accent="navy"
                severity="medium"
              >
                <div className="px-5 py-5 space-y-4">
                  <p className="text-[13px] text-slate-700 leading-relaxed">
                    No hay reporte cargado para{" "}
                    <span className="font-semibold text-slate-900">{fmtMonthLabel(currentMonth)}</span>.
                    {" "}Sin datos del mes actual los KPIs y proyecciones quedan ciegos.
                  </p>
                  <Link
                    href="/admin/reports"
                    className="inline-flex items-center gap-2 h-10 rounded-xl bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] hover:shadow-[0_8px_24px_rgba(228,45,44,0.30)] transition-all"
                  >
                    <FileBarChart className="h-3.5 w-3.5" />
                    Cargar Métricas
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </IssueSection>
            )}

            {/* Declining metrics */}
            {declining.length > 0 && (
              <IssueSection
                icon={TrendingDown}
                title="Métricas en caída"
                count={declining.length}
                href="/dashboard"
                accent="red"
                severity={declining.length > 2 ? "high" : "medium"}
              >
                <div className="divide-y divide-slate-100">
                  {declining.map(m => (
                    <div key={m.key} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{m.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {m.format === "money" ? fmtMoney(m.previous) : fmtNumber(m.previous)}{" "}
                          <span className="text-slate-400">→</span>{" "}
                          {m.format === "money" ? fmtMoney(m.current) : fmtNumber(m.current)}
                        </p>
                      </div>
                      <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold tabular-nums text-red-700 shrink-0 flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        {m.pct.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </IssueSection>
            )}
          </div>
        </div>
      ) : null}

      {/* IMPROVEMENTS / WHAT'S GOOD ───────────────────────────────────────── */}
      {improving.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="h-3.5 w-3.5 text-emerald-700/80" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">
              Lo que está mejorando
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {improving.map(m => (
              <div key={m.key} className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.04] via-white to-white p-4 hover:border-emerald-500/25 transition-colors">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-[12px] font-medium text-slate-800 truncate">{m.label}</p>
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700 shrink-0 flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" />
                    {m.pct.toFixed(0)}%
                  </span>
                </div>
                <p className="text-[20px] font-bold tabular-nums text-slate-900">
                  {m.format === "money" ? fmtMoney(m.current) : fmtNumber(m.current)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  vs {m.format === "money" ? fmtMoney(m.previous) : fmtNumber(m.previous)} mes anterior
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUICK NAV ────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Activity className="h-3.5 w-3.5 text-[#1e3a8a]" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">
            Atajos rápidos
          </h2>
          <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { href: "/dashboard",       label: "Panel",              desc: "KPIs y proyecciones",  icon: BarChart3 },
            { href: "/admin/personas",  label: "Personas Agendadas", desc: "Pipeline + seguimientos", icon: Users2 },
            { href: "/admin/tasks",     label: "Tareas",             desc: "Gestión de pendientes", icon: ListTodo },
            { href: "/admin/reports",   label: "Cargar Métricas",    desc: "Form mensual",         icon: FileBarChart },
          ].map(s => {
            const Icon = s.icon
            return (
              <Link
                key={s.href}
                href={s.href}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white hover:border-[#1e3a8a]/30 hover:shadow-[0_4px_20px_rgba(30,58,138,0.10)] transition-all p-4"
              >
                <div className="pointer-events-none absolute -top-12 -right-12 h-24 w-24 rounded-full bg-[#1e3a8a]/[0.08] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative flex items-start justify-between gap-3 mb-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200 group-hover:bg-[#1e3a8a]/10 group-hover:ring-[#1e3a8a]/25 transition-colors">
                    <Icon className="h-4 w-4 text-slate-500 group-hover:text-[#1e3a8a] transition-colors" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#1e3a8a] group-hover:translate-x-0.5 transition-all" />
                </div>

                <p className="relative text-[13px] font-bold text-slate-900">{s.label}</p>
                <p className="relative text-[11px] text-slate-400 mt-0.5">{s.desc}</p>
              </Link>
            )
          })}
        </div>
      </div>

    </div>
  )
}
