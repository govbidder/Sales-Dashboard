"use client"

import { fetchWithViewAs } from "@/lib/api/fetch-with-view-as"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { AiStandupModal } from "@/components/views/inicio/ai-standup-modal"
import {
  Loader2, AlertCircle, AlertTriangle, CheckCircle2, RefreshCw,
  Users2, ListTodo, FileBarChart, TrendingDown, TrendingUp,
  ArrowRight, Flag, Sparkles,
  Sun, Calendar as CalIcon, Layers,
  KanbanSquare, BookMarked, Briefcase, Bell,
} from "lucide-react"
import type { Department } from "@/lib/types/department"
import { useViewAs } from "@/lib/contexts/view-as-context"
import { useEffectiveRole } from "@/hooks/use-effective-role"
import { isAdminOrAbove, type Role } from "@/lib/types/role"
import { CountUp } from "@/components/ui/count-up"
import { InicioSkeleton } from "@/components/ui/skeleton"

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
    neutral: { ring: "ring-border",   icon: "bg-muted   text-muted-foreground",    glow: "rgba(15,23,42,0.05)" },
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
          <p className="text-[28px] font-bold tabular-nums text-foreground leading-none">{value}</p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
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
    <div className={`overflow-hidden rounded-2xl border ${palette.border} bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}>
      <div className={`flex items-center justify-between gap-3 px-5 py-4 border-b border-border ${palette.headerBg}`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${palette.iconBg}`}>
            <Icon className={`h-4 w-4 ${palette.iconColor}`} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-foreground leading-none truncate">{title}</h3>
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
            className="group flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:border-[#1e3a8a]/30 hover:text-[#1e3a8a] transition-colors"
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
  // Rol real del caller (de profiles). Lo usamos para decidir qué secciones
  // se renderizan — Team users no ven la grilla cross-empresa.
  const [realRole,     setRealRole]     = useState<Role | null>(null)
  // Department_id del caller — gobierna las cards contextuales para team users
  // ("Mi área", atajos, etc.). null = sin depto asignado todavía.
  const [myDeptId,     setMyDeptId]     = useState<string | null>(null)
  const effectiveRole = useEffectiveRole(realRole)
  const isAdmin       = isAdminOrAbove(effectiveRole)

  // View-As: si simulás un depto, esa card se destaca; las otras se dimean.
  const { viewAsDepartmentId: simulatedDeptId } = useViewAs()

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentEmail(session.user?.email ?? "")

      // Cargar el rol REAL + depto del caller. El rol afecta qué secciones se
      // renderizan; el depto se usa en las cards contextuales para team users.
      const { data: profile } = await supabase
        .from("profiles").select("role, department_id").eq("id", session.user.id).single()
      setRealRole((profile?.role as Role | undefined) ?? null)
      setMyDeptId((profile?.department_id as string | null | undefined) ?? null)

      const res = await fetchWithViewAs("/api/admin/health", {
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
        fetchWithViewAs("/api/admin/tasks?include_subtasks=false", { headers }),
        fetchWithViewAs("/api/departments",                        { headers }),
        fetchWithViewAs("/api/admin/team",                         { headers }),
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
    return <InicioSkeleton deptCount={5} />
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

  // Conteo de tareas mías de hoy (ya filtradas por owner=currentEmail en myDay).
  // Definidos arriba del statusLine porque éste los usa para team users.
  const myOverdueCount  = myDay.filter(t => t.overdue).length
  const myDueTodayCount = myDay.length - myOverdueCount

  // Status line narrativo — frase que comunica decisión (no número abstracto).
  // Para admin: mira el estado global de la empresa.
  // Para team user: enfoque personal — sus tareas, no las del resto.
  const statusLine = (() => {
    if (!isAdmin) {
      // Team view: hablamos al usuario directo. Si tiene cosas asignadas, las
      // priorizamos por urgencia. Sino, mensaje de "estás al día".
      if (myOverdueCount > 0 && myDueTodayCount > 0) {
        return `Tenés ${myOverdueCount} ${myOverdueCount === 1 ? "tarea vencida" : "tareas vencidas"} y ${myDueTodayCount} que ${myDueTodayCount === 1 ? "vence" : "vencen"} hoy.`
      }
      if (myOverdueCount > 0) {
        return `Tenés ${myOverdueCount} ${myOverdueCount === 1 ? "tarea vencida" : "tareas vencidas"}. Empezá por ahí.`
      }
      if (myDueTodayCount > 0) {
        return `Tenés ${myDueTodayCount} ${myDueTodayCount === 1 ? "tarea para hacer hoy" : "tareas para hacer hoy"}.`
      }
      return "Estás al día. Sin tareas vencidas ni pendientes para hoy."
    }
    // Admin view (original).
    if (allClear) return "Todo al día. Sin tareas vencidas, métricas al día."
    const pieces: string[] = []
    if (counts.overdueTasks > 0) {
      pieces.push(`${counts.overdueTasks} ${counts.overdueTasks === 1 ? "tarea vencida" : "tareas vencidas"}`)
    }
    if (counts.stalePersonas > 0) {
      pieces.push(`${counts.stalePersonas} sin seguimiento`)
    }
    if (missingCurrentReport) {
      pieces.push(`métricas de ${fmtMonthLabel(currentMonth)} pendientes`)
    }
    if (declining.length > 0) {
      pieces.push(`${declining.length} ${declining.length === 1 ? "métrica" : "métricas"} en caída`)
    }
    if (pieces.length === 0) return `${issuesCount} cosas pidiendo atención.`
    if (pieces.length === 1) return `Hoy: ${pieces[0]}.`
    return `Hoy: ${pieces.slice(0, -1).join(", ")} y ${pieces.slice(-1)}.`
  })()

  // Estado narrativo para el ícono del status line cuando es team user.
  const teamHeroState = myOverdueCount > 0 ? "critical" : myDueTodayCount > 0 ? "warning" : "good"
  const effectiveHeroState = isAdmin ? heroState : teamHeroState

  // Departamentos rankeados por urgencia (overdue DESC, luego pending DESC).
  // Los OK quedan al final con visual sutil.
  const rankedDepts = [...departments].sort((a, b) => {
    const sa = deptStats[a.id] ?? { pending: 0, overdue: 0, members: 0 }
    const sb = deptStats[b.id] ?? { pending: 0, overdue: 0, members: 0 }
    if (sb.overdue !== sa.overdue) return sb.overdue - sa.overdue
    return sb.pending - sa.pending
  })

  // Depto del caller — alimenta las cards contextuales para team users.
  const myDept      = myDeptId ? departments.find(d => d.id === myDeptId) ?? null : null
  const myDeptStat  = myDeptId ? deptStats[myDeptId] ?? { pending: 0, overdue: 0, members: 0 } : null

  return (
    <div className="space-y-5">

      {showStandup && <AiStandupModal onClose={() => setShowStandup(false)} />}

      {/* STATUS LINE — sentence-first + score chico al costado ─────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-4 sm:px-6 sm:py-5">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-20 -right-20 h-[220px] w-[220px] rounded-full blur-[80px]"
            style={{
              backgroundColor:
                effectiveHeroState === "good"     ? "rgba(16,185,129,0.06)" :
                effectiveHeroState === "critical" ? "rgba(228,45,44,0.08)"  :
                                                    "rgba(251,191,36,0.06)",
            }}
          />
        </div>

        <div className="relative flex items-center gap-4 sm:gap-6">
          {/* Status icon */}
          <span className={`shrink-0 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl ${
            effectiveHeroState === "good"     ? "bg-emerald-500/15"  :
            effectiveHeroState === "critical" ? "bg-[#E42D2C]/15"    :
                                                "bg-amber-500/15"
          }`}>
            {effectiveHeroState === "good"     ? <CheckCircle2  className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-700" /> :
             effectiveHeroState === "critical" ? <AlertCircle   className="h-4 w-4 sm:h-5 sm:w-5 text-[#E42D2C]"   /> :
                                                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-700"  />}
          </span>

          {/* Sentence */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.20em] text-[#1e3a8a]/80 mb-1">
              {isAdmin ? "Estado del Dashboard" : "Tu día"}
            </p>
            <p className="text-[15px] sm:text-[17px] font-semibold text-foreground leading-snug">
              {statusLine}
            </p>
          </div>

          {/* Score chico — solo admin (los team users no necesitan ver salud global) */}
          {isAdmin && (
            <div className="shrink-0 hidden sm:flex flex-col items-center gap-0.5 border-l border-border pl-5">
              <CountUp
                value={healthScore}
                duration={1000}
                className={`text-[28px] font-bold leading-none ${scoreColor}`}
              />
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Salud
              </p>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <button
              onClick={() => setShowStandup(true)}
              className="inline-flex items-center gap-1.5 h-8 rounded-full border border-[#1e3a8a]/25 bg-[#1e3a8a]/[0.04] px-3 text-[11.5px] font-bold text-[#1e3a8a] hover:border-[#1e3a8a]/40 hover:bg-[#1e3a8a]/[0.08] transition-all"
            >
              <Sparkles className="h-3 w-3" />
              Generar standup
            </button>
          ) : (
            <Link
              href="/admin/tasks"
              className="inline-flex items-center gap-1.5 h-8 rounded-full border border-[#1e3a8a]/25 bg-[#1e3a8a]/[0.04] px-3 text-[11.5px] font-bold text-[#1e3a8a] hover:border-[#1e3a8a]/40 hover:bg-[#1e3a8a]/[0.08] transition-all"
            >
              <KanbanSquare className="h-3 w-3" />
              Ir a mi kanban
            </Link>
          )}
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-8 rounded-full border border-border bg-card px-3 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* MI ÁREA + ATAJOS — solo para team users (no admin) ────────────────── */}
      {!isAdmin && (
        <div className="grid gap-3 lg:grid-cols-3">
          {/* Mi área card (ocupa 2/3 en desktop) */}
          {myDept ? (
            <MyAreaCard dept={myDept} stats={myDeptStat!} />
          ) : (
            <div className="lg:col-span-2 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-50/40 dark:bg-amber-500/[0.04] px-5 py-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-foreground mb-1">
                  Todavía no tenés un departamento asignado.
                </p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Pedile a un admin que te asigne uno desde <span className="font-mono text-[11px]">/admin/team</span>.
                  Sin esto no vas a ver tu Kanban filtrado ni vas a poder crear SOPs en tu área.
                </p>
              </div>
            </div>
          )}

          {/* Atajos: 4 botones laterales en 1 columna lg, grid 2x2 en mobile */}
          <QuickLinksGrid deptId={myDeptId} />
        </div>
      )}

      {/* 3 CRITICAL CARDS — top-left = más urgente ─────────────────────────── */}
      {isAdmin && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {/* 1. Tareas vencidas (top-left = más urgente) */}
          <CriticalCard
            icon={AlertCircle}
            label="Tareas vencidas"
            value={counts.overdueTasks}
            tone={counts.overdueTasks > 0 ? "danger" : "ok"}
            sub={counts.overdueTasks > 0
              ? `${counts.overdueTasks === 1 ? "Una tarea pide" : "Varias tareas piden"} acción.`
              : "Al día. Buen trabajo."}
            ctaLabel={counts.overdueTasks > 0 ? "Ver kanban" : "Ver tareas"}
            ctaHref="/admin/tasks"
          />

          {/* 2. Personas sin seguimiento */}
          <CriticalCard
            icon={Users2}
            label="Personas sin seguimiento"
            value={counts.stalePersonas}
            tone={counts.stalePersonas > 0 ? "warning" : "ok"}
            sub={counts.stalePersonas > 0
              ? `${counts.stalePersonas === 1 ? "Una persona" : `${counts.stalePersonas} personas`} sin contactar hace 7+ días.`
              : "Todas con seguimiento reciente."}
            ctaLabel="Ver personas"
            ctaHref="/admin/personas"
          />

          {/* 3. Métricas del mes */}
          <CriticalCard
            icon={FileBarChart}
            label="Métricas del mes"
            value={missingCurrentReport ? "—" : "✓"}
            tone={missingCurrentReport ? "info" : "ok"}
            sub={missingCurrentReport
              ? `${fmtMonthLabel(currentMonth)} pendiente de carga.`
              : `${fmtMonthLabel(currentMonth)} cargado.`}
            ctaLabel={missingCurrentReport ? "Cargar reporte" : "Ver métricas"}
            ctaHref={missingCurrentReport ? "/admin/reports" : "/metrics"}
          />
        </div>
      )}

      {/* DEPARTAMENTOS — lista rankeada por urgencia ─────────────────────── */}
      {isAdmin && rankedDepts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Layers className="h-3.5 w-3.5 text-[#1e3a8a]" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">
              Departamentos
            </h2>
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground tabular-nums">
              {rankedDepts.length}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
            {rankedDepts.map(d => {
              const s = deptStats[d.id] ?? { pending: 0, overdue: 0, members: 0 }
              const isOk        = s.overdue === 0
              const isSimHigh   = simulatedDeptId && simulatedDeptId === d.id
              const isSimDim    = simulatedDeptId && simulatedDeptId !== d.id

              return (
                <Link
                  key={d.id}
                  href={`/admin/departments/${d.id}`}
                  className={`group flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 transition-all ${
                    isSimHigh
                      ? "bg-amber-500/[0.05] ring-1 ring-inset ring-amber-400/40"
                      : "hover:bg-muted"
                  } ${isSimDim ? "opacity-40 hover:opacity-70" : ""} ${isOk && !isSimHigh ? "opacity-75 hover:opacity-100" : ""}`}
                >
                  {/* Color dot */}
                  <span
                    className="h-3 w-3 rounded-full shrink-0 ring-2 ring-background"
                    style={{ backgroundColor: d.color }}
                  />

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] truncate ${isOk ? "font-semibold text-muted-foreground" : "font-bold text-foreground"}`}>
                      {d.name}
                    </p>
                  </div>

                  {/* Stats inline */}
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-[12px] tabular-nums">
                    <span className="hidden sm:inline text-muted-foreground">
                      {s.pending} {s.pending === 1 ? "pendiente" : "pendientes"}
                    </span>
                    {s.overdue > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 font-bold text-[#E42D2C]">
                        <AlertCircle className="h-3 w-3" />
                        {s.overdue} venc{s.overdue === 1 ? "ida" : "idas"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Al día
                      </span>
                    )}
                    <span className="hidden sm:inline-flex items-center gap-1 text-muted-foreground" title="Miembros del depto">
                      <Users2 className="h-3 w-3" />
                      {s.members}
                    </span>
                  </div>

                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-[#1e3a8a] group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* MI DÍA — empty state amigable para team users cuando no hay tareas ─ */}
      {currentEmail && myDay.length === 0 && !isAdmin && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">
              Mi día
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
          </div>
          <div className="rounded-2xl border border-border bg-card px-5 py-6 flex items-center gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-foreground">
                No tenés tareas asignadas para hoy.
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                Cuando un admin te asigne tareas con due hoy o vencidas, las vas a ver acá. Mientras tanto, podés mirar tu kanban completo o el centro operativo.
              </p>
            </div>
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
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground tabular-nums">
              {myDay.length}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="divide-y divide-border">
              {myDay.slice(0, 6).map(t => (
                <Link
                  key={t.id}
                  href="/admin/tasks"
                  className="group flex items-center gap-3 px-5 py-3 hover:bg-muted transition-colors"
                >
                  <span className={`shrink-0 h-2 w-2 rounded-full ${
                    t.priority === "urgente" ? "bg-[#E42D2C]" :
                    t.priority === "alta"    ? "bg-orange-500" :
                    t.priority === "media"   ? "bg-amber-500" :
                                                "bg-slate-300"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{t.title}</p>
                    {t.due_at && (
                      <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${t.overdue ? "text-[#E42D2C] font-semibold" : "text-muted-foreground"}`}>
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
                                                "text-muted-foreground"
                  }`} />
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-[#1e3a8a] group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
              {myDay.length > 6 && (
                <Link
                  href="/admin/tasks"
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-[11px] font-semibold text-muted-foreground hover:text-[#1e3a8a] transition-colors hover:bg-muted"
                >
                  Ver las {myDay.length - 6} restantes
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DRILL-DOWN — detalle de issues (overdue + stale + declining) ─────── */}
      {isAdmin && (overdueTasks.length > 0 || stalePersonas.length > 0 || declining.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <AlertCircle className="h-3.5 w-3.5 text-red-700/80" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">
              Detalle de lo que falta resolver
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
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
                <div className="divide-y divide-border">
                  {overdueTasks.slice(0, 5).map(t => (
                    <Link
                      key={t.id}
                      href="/admin/tasks"
                      className="group flex items-center gap-3 px-5 py-3 hover:bg-muted transition-colors"
                    >
                      <Flag className={`h-3.5 w-3.5 shrink-0 ${PRIORITY_FLAG[t.priority]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{t.title}</p>
                        <p className="text-[11px] text-red-700/80 mt-0.5">
                          Venció {fmtRelative(t.due_at)}
                          {t.owner && <span className="text-muted-foreground"> · {t.owner}</span>}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  ))}
                  {overdueTasks.length > 5 && (
                    <Link href="/admin/tasks" className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors hover:bg-muted">
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
                <div className="divide-y divide-border">
                  {stalePersonas.slice(0, 5).map(p => (
                    <Link
                      key={p.id}
                      href="/admin/personas"
                      className="group flex items-center gap-3 px-5 py-3 hover:bg-muted transition-colors"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff6b6a] to-[#c42423] text-[10px] font-bold text-white shadow-sm shrink-0">
                        {(p.name ?? "?").split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{p.name}</p>
                        <p className="text-[11px] text-amber-700/80 mt-0.5">
                          Último contacto {fmtRelative(p.last_contact)}
                          {p.owner && <span className="text-muted-foreground"> · {p.owner}</span>}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  ))}
                </div>
              </IssueSection>
            )}

            {/* Declining metrics */}
            {declining.length > 0 && (
              <IssueSection
                icon={TrendingDown}
                title="Métricas en caída"
                count={declining.length}
                href="/metrics"
                accent="red"
                severity={declining.length > 2 ? "high" : "medium"}
              >
                <div className="divide-y divide-border">
                  {declining.map(m => (
                    <div key={m.key} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-foreground truncate">{m.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {m.format === "money" ? fmtMoney(m.previous) : fmtNumber(m.previous)}{" "}
                          <span className="text-muted-foreground">→</span>{" "}
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
      )}

      {/* IMPROVEMENTS / WHAT'S GOOD — condicional ──────────────────────────── */}
      {improving.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="h-3.5 w-3.5 text-emerald-700/80" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">
              Lo que está mejorando
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {improving.map(m => (
              <div key={m.key} className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.04] via-card to-card p-4 hover:border-emerald-500/25 transition-colors">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-[12px] font-medium text-foreground truncate">{m.label}</p>
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700 shrink-0 flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" />
                    {m.pct.toFixed(0)}%
                  </span>
                </div>
                <p className="text-[20px] font-bold tabular-nums text-foreground">
                  {m.format === "money" ? fmtMoney(m.current) : fmtNumber(m.current)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  vs {m.format === "money" ? fmtMoney(m.previous) : fmtNumber(m.previous)} mes anterior
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Critical Card ────────────────────────────────────────────────────────────
// 3-up grid en la parte superior del dashboard. Cada card representa una
// dimensión del estado del negocio: tareas vencidas, personas sin segto,
// métricas del mes. Patrón "decision-driven" (Linear/Stripe): número grande
// + status + sub-frase + CTA.

function CriticalCard({
  icon: Icon, label, value, tone, sub, ctaLabel, ctaHref,
}: {
  icon:     any
  label:    string
  value:    number | string
  tone:     "danger" | "warning" | "info" | "ok"
  sub:      string
  ctaLabel: string
  ctaHref:  string
}) {
  const palette = {
    danger:  { iconBg: "bg-[#E42D2C]/12 ring-[#E42D2C]/25", iconColor: "text-[#E42D2C]",  valueColor: "text-[#E42D2C]" },
    warning: { iconBg: "bg-amber-500/12 ring-amber-500/25", iconColor: "text-amber-700",  valueColor: "text-amber-700" },
    info:    { iconBg: "bg-[#1e3a8a]/12 ring-[#1e3a8a]/25", iconColor: "text-[#1e3a8a]",  valueColor: "text-[#1e3a8a]" },
    ok:      { iconBg: "bg-emerald-500/12 ring-emerald-500/25", iconColor: "text-emerald-700", valueColor: "text-emerald-700" },
  }[tone]

  return (
    <Link
      href={ctaHref}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.10)] hover:border-foreground/15"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${palette.iconBg}`}>
          <Icon className={`h-4 w-4 ${palette.iconColor}`} />
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-[#1e3a8a] group-hover:translate-x-0.5 transition-all" />
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
        {label}
      </p>

      <p className={`text-[36px] sm:text-[40px] font-bold tabular-nums leading-none ${palette.valueColor}`}>
        {typeof value === "number" ? <CountUp value={value} duration={900} /> : value}
      </p>

      <p className="text-[12px] text-muted-foreground mt-3 leading-relaxed">
        {sub}
      </p>

      <p className="text-[11.5px] font-semibold text-[#1e3a8a] mt-3 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
        {ctaLabel}
        <ArrowRight className="h-3 w-3" />
      </p>
    </Link>
  )
}

// ─── My Area Card (team users) ───────────────────────────────────────────────
//
// Card prominente que muestra al team user el estado actual de SU área. Color
// del depto al lado izquierdo, stats inline, y CTAs para entrar al detalle.
// Reemplaza la "vista de empresa" que solo ven los admins.

function MyAreaCard({
  dept,
  stats,
}: {
  dept:  Department
  stats: DeptStat
}) {
  const isOverloaded = stats.overdue > 0
  const isHealthy    = stats.overdue === 0 && stats.pending <= 5
  const accentBg     = `${dept.color}14`   // 8% opacity en hex
  const accentBorder = `${dept.color}3d`   // 24% opacity

  return (
    <div
      className="lg:col-span-2 relative overflow-hidden rounded-2xl border p-5 sm:p-6"
      style={{ borderColor: accentBorder, backgroundColor: accentBg }}
    >
      {/* Color accent bar */}
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: dept.color }}
      />

      <div className="flex items-start gap-4">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
          style={{ backgroundColor: `${dept.color}26` }}
        >
          <Briefcase className="h-5 w-5" style={{ color: dept.color }} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.20em] mb-1" style={{ color: dept.color }}>
            Mi área
          </p>
          <h3 className="text-[18px] sm:text-[20px] font-bold text-foreground leading-tight">
            {dept.name}
          </h3>
          <p className="text-[12px] text-muted-foreground mt-1">
            {isOverloaded
              ? `Hay ${stats.overdue} ${stats.overdue === 1 ? "tarea vencida" : "tareas vencidas"} en el área — coordinen para destrabar.`
              : isHealthy
                ? "El área está al día. Buen ritmo."
                : `${stats.pending} pendientes activas en el área.`}
          </p>
        </div>
      </div>

      {/* Stats inline */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-xl bg-card/60 border border-border/40 px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-1">
            Pendientes
          </p>
          <p className="text-[20px] font-bold tabular-nums text-foreground leading-none">
            <CountUp value={stats.pending} duration={700} />
          </p>
        </div>
        <div className="rounded-xl bg-card/60 border border-border/40 px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-1">
            Vencidas
          </p>
          <p className={`text-[20px] font-bold tabular-nums leading-none ${stats.overdue > 0 ? "text-[#E42D2C]" : "text-foreground"}`}>
            <CountUp value={stats.overdue} duration={700} />
          </p>
        </div>
        <div className="rounded-xl bg-card/60 border border-border/40 px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-1">
            Miembros
          </p>
          <p className="text-[20px] font-bold tabular-nums text-foreground leading-none">
            <CountUp value={stats.members} duration={700} />
          </p>
        </div>
      </div>

      {/* CTAs */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/admin/departments/${dept.id}`}
          className="inline-flex items-center gap-1.5 h-8 rounded-full border border-border bg-card/80 px-3 text-[11.5px] font-semibold text-foreground hover:bg-card transition-all"
        >
          <Layers className="h-3 w-3" />
          Ver detalle del área
          <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href="/admin/tasks"
          className="inline-flex items-center gap-1.5 h-8 rounded-full px-3 text-[11.5px] font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: dept.color }}
        >
          <KanbanSquare className="h-3 w-3" />
          Kanban del área
        </Link>
      </div>
    </div>
  )
}

// ─── Quick Links Grid (team users) ───────────────────────────────────────────
//
// 4 atajos rápidos en una columna lateral (desktop) o 2x2 grid (mobile).
// Los links son context-aware: si el user tiene depto, "SOPs" lleva con filtro
// pre-seleccionado por su área.

function QuickLinksGrid({ deptId }: { deptId: string | null }) {
  const links = [
    { href: "/admin/tasks",            label: "Mis tareas",      icon: ListTodo,     accent: "text-[#1e3a8a]" },
    { href: "/admin/centro-operativo", label: "SOPs y recursos", icon: BookMarked,   accent: "text-emerald-700" },
    { href: "/admin/personas",         label: "Personas",        icon: Users2,       accent: "text-purple-700" },
    { href: "/calendar",               label: "Calendario",      icon: CalIcon,      accent: "text-amber-700" },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
      {links.map(l => {
        const Icon = l.icon
        return (
          <Link
            key={l.href}
            href={l.href}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-foreground/20 hover:bg-muted transition-all"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted flex-shrink-0">
              <Icon className={`h-4 w-4 ${l.accent}`} />
            </span>
            <span className="flex-1 text-[13px] font-semibold text-foreground truncate">{l.label}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-[#1e3a8a] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </Link>
        )
      })}
    </div>
  )
}
