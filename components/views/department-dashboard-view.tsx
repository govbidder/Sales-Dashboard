"use client"

/**
 * Dashboard dedicado por departamento:
 *  - Hero con nombre del depto + color + 4 stats compactas.
 *  - Sección KPIs del depto (usa useMonthlyReports con scope al depto).
 *  - Sección Tareas del depto (lista compacta + link al kanban filtrado).
 *
 * Acceso desde el sidebar (item "Por departamento" para admins, o desde
 * la card "Departamentos" de /inicio).
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { fetchWithViewAs } from "@/lib/api/fetch-with-view-as"
import { createClient } from "@/lib/supabase"
import { useMonthlyReports } from "@/hooks/use-monthly-reports"
import { useSelectedMonth } from "@/components/layout/dashboard-layout"
import type { Department } from "@/lib/types/department"
import {
  Loader2, AlertCircle, ArrowRight, ArrowLeft, ListTodo, Users2,
  CalendarClock, CheckCircle2, MessageCircle, DollarSign, Flag,
  TrendingDown, TrendingUp,
} from "lucide-react"

interface DeptTask {
  id:          string
  title:       string
  status:      string
  priority:    "baja" | "media" | "alta" | "urgente"
  owner:       string | null
  assignees:   string[]
  due_at:      string | null
  completed_at: string | null
  department_id: string | null
}

interface DeptMember {
  id:         string
  email:      string | null
  full_name:  string | null
  role:       string
  department_id: string | null
}

const TERMINAL_STATUSES = new Set(["completada", "cancelada"])

// Subset de KPIs que tiene sentido mostrar a nivel depto. Los puramente
// corporativos (MRR, total revenue empresa) los dejamos para el dashboard
// global; acá enfocamos en operación.
const DEPT_KPI_DEFS = [
  { key: "scheduled_calls",      label: "Llamadas Agendadas",     money: false, icon: CalendarClock, color: "#1e3a8a" },
  { key: "cierres_por_offerdoc", label: "Cerradas",               money: false, icon: CheckCircle2,  color: "#059669" },
  { key: "open_conversations",   label: "Conversaciones Abiertas",money: false, icon: MessageCircle, color: "#8b5cf6" },
  { key: "ad_spend",             label: "Gasto en Ads",           money: true,  icon: DollarSign,    color: "#E42D2C" },
] as const

function fmtMoney(v: any) {
  if (v == null || v === "") return "—"
  const n = Number(v)
  return Number.isFinite(n) ? `$${n.toLocaleString()}` : "—"
}
function fmtNumber(v: any) {
  if (v == null || v === "") return "—"
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString() : "—"
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1)   return "ahora"
  if (min < 60)  return `hace ${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24)   return `hace ${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7)   return `hace ${day} días`
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

const PRIORITY_FLAG: Record<string, string> = {
  baja:    "text-zinc-600",
  media:   "text-amber-700",
  alta:    "text-orange-700",
  urgente: "text-red-700",
}

export function DepartmentDashboardView({ departmentId }: { departmentId: string }) {
  const [dept,    setDept]    = useState<Department | null>(null)
  const [tasks,   setTasks]   = useState<DeptTask[]>([])
  const [members, setMembers] = useState<DeptMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Snapshot de "ahora" al primer render (lazy init evita la lint rule de
  // react-hooks/purity por llamar Date.now() durante render).
  const [now] = useState(() => Date.now())

  // KPIs del depto (PR-B: useMonthlyReports acepta scope).
  const { reports, loading: reportsLoading } = useMonthlyReports(departmentId)
  const selectedMonth = useSelectedMonth()
  const effectiveMonth = (selectedMonth ?? "").slice(0, 7)

  const { current, previous } = useMemo(() => {
    if (!reports.length) return { current: null, previous: null }
    let idx = effectiveMonth ? reports.findIndex(r => r.month === effectiveMonth) : -1
    if (idx === -1) idx = reports.length - 1
    return {
      current:  reports[idx]     ?? null,
      previous: reports[idx - 1] ?? null,
    }
  }, [reports, effectiveMonth])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: { session } } = await createClient().auth.getSession()
        if (!session) return
        const headers = { Authorization: `Bearer ${session.access_token}` }

        const [deptRes, tasksRes, teamRes] = await Promise.all([
          fetchWithViewAs("/api/departments",                              { headers }),
          fetchWithViewAs("/api/admin/tasks?include_subtasks=false",      { headers }),
          fetchWithViewAs("/api/admin/team",                               { headers }),
        ])

        if (!mounted) return

        if (deptRes.ok) {
          const j = await deptRes.json()
          const found = (j.departments ?? []).find((d: any) => d.id === departmentId)
          if (!found) setError("Departamento no encontrado")
          else setDept(found)
        }

        if (tasksRes.ok) {
          const j = await tasksRes.json()
          const filtered = (j.tasks ?? [])
            .filter((t: any) => t.department_id === departmentId)
          setTasks(filtered)
        }

        if (teamRes.ok) {
          const j = await teamRes.json()
          const filtered = (j.members ?? [])
            .filter((m: any) => m.department_id === departmentId)
          setMembers(filtered)
        }
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Error")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [departmentId])

  // Memos arriba de los early returns (rules-of-hooks).
  const { pending, overdue, completed, sortedPending } = useMemo(() => {
    const pend = tasks.filter(t => !TERMINAL_STATUSES.has(t.status))
    const over = pend.filter(t => t.due_at && new Date(t.due_at).getTime() < now)
    const comp = tasks.filter(t => t.status === "completada")
    const sortedPend = [...pend].sort((a, b) => {
      const aOver = a.due_at && new Date(a.due_at).getTime() < now
      const bOver = b.due_at && new Date(b.due_at).getTime() < now
      if (aOver !== bOver) return aOver ? -1 : 1
      return (a.due_at ?? "").localeCompare(b.due_at ?? "")
    })
    return { pending: pend, overdue: over, completed: comp, sortedPending: sortedPend }
  }, [tasks, now])

  if (loading && !dept) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
      </div>
    )
  }

  if (error || !dept) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-red-600 mb-2" />
        <p className="text-sm text-red-700">{error ?? "Departamento no encontrado"}</p>
        <Link
          href="/admin/departments"
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a Departamentos
        </Link>
      </div>
    )
  }

  const calcDelta = (key: string) => {
    if (!current || !previous) return { diff: null as number | null, pct: null as number | null }
    const cur  = Number((current  as any)[key])
    const prev = Number((previous as any)[key])
    if (!Number.isFinite(cur) || !Number.isFinite(prev)) return { diff: null, pct: null }
    const diff = cur - prev
    const pct  = prev === 0 ? null : (diff / prev) * 100
    return { diff, pct }
  }

  return (
    <div className="space-y-6">

      {/* HERO ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: dept.color }}
        />

        <div className="relative grid lg:grid-cols-[1fr_auto] gap-6 p-6 sm:p-8 items-end">
          <div className="min-w-0">
            <Link
              href="/admin/departments"
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 hover:text-slate-700 mb-3"
            >
              <ArrowLeft className="h-3 w-3" />
              Departamentos
            </Link>
            <div className="flex items-center gap-3 mb-2">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-bold text-white shadow-sm"
                style={{ backgroundColor: dept.color }}
              >
                {dept.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-slate-900 leading-[1.05] truncate">
                  {dept.name}
                </h1>
                {dept.description && (
                  <p className="text-[13px] text-slate-500 mt-0.5 line-clamp-2">{dept.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 border-t border-slate-100">
          {[
            { label: "Miembros",      val: members.length, icon: Users2,   accent: "navy"  as const },
            { label: "Tareas activas",val: pending.length, icon: ListTodo, accent: "navy"  as const },
            { label: "Vencidas",      val: overdue.length, icon: AlertCircle, accent: overdue.length > 0 ? "red" : "neutral" as const },
            { label: "Completadas",   val: completed.length, icon: CheckCircle2, accent: "emerald" as const },
          ].map((s, i) => {
            const Icon = s.icon
            const text =
              s.accent === "red"     ? "text-[#E42D2C]" :
              s.accent === "emerald" ? "text-emerald-700" :
              s.accent === "navy"    ? "text-[#1e3a8a]" :
                                       "text-slate-900"
            return (
              <div key={s.label} className={`px-5 py-4 ${i < 3 ? "sm:border-r border-slate-100" : ""} ${i < 2 ? "border-b sm:border-b-0 border-slate-100" : ""}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1e3a8a]/80">
                    {s.label}
                  </span>
                </div>
                <p className={`text-[24px] font-bold tabular-nums ${text} leading-none`}>{s.val}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* KPIs DEL DEPTO ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <DollarSign className="h-3.5 w-3.5 text-[#1e3a8a]" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">
            KPIs del departamento
          </h2>
          {current && (
            <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600 tabular-nums">
              {current.month}
            </span>
          )}
          <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
        </div>

        {reportsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-[#E42D2C]/40" />
          </div>
        ) : !current ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-[13px] text-slate-500">
              No hay KPIs cargados para este departamento todavía.
            </p>
            <Link
              href={`/admin/reports`}
              className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1e3a8a] hover:text-[#152978]"
            >
              Cargar reporte
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DEPT_KPI_DEFS.map(kpi => {
              const rawVal = (current as any)[kpi.key]
              const value  = kpi.money ? fmtMoney(rawVal) : fmtNumber(rawVal)
              const delta  = calcDelta(kpi.key)
              const isUp   = delta.diff !== null && delta.diff > 0
              const isDown = delta.diff !== null && delta.diff < 0
              const Icon   = kpi.icon
              return (
                <div key={kpi.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${kpi.color}15`, boxShadow: `0 0 0 1px ${kpi.color}25` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                    </span>
                    {delta.diff !== null && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isUp   ? "bg-emerald-500/10 text-emerald-700" :
                        isDown ? "bg-red-500/10 text-red-700" :
                                 "bg-slate-100 text-slate-500"
                      }`}>
                        {isUp   && <TrendingUp   className="h-3 w-3" />}
                        {isDown && <TrendingDown className="h-3 w-3" />}
                        {delta.pct !== null
                          ? `${delta.pct > 0 ? "+" : ""}${Math.round(delta.pct)}%`
                          : `${delta.diff > 0 ? "+" : ""}${kpi.money ? fmtMoney(Math.abs(delta.diff)) : delta.diff.toLocaleString()}`}
                      </span>
                    )}
                  </div>
                  <p className="text-[24px] font-bold tabular-nums text-slate-900 leading-none">{value}</p>
                  <p className="mt-1.5 text-[11px] text-slate-500">{kpi.label}</p>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* TAREAS DEL DEPTO ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <ListTodo className="h-3.5 w-3.5 text-[#1e3a8a]" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">
            Tareas activas
          </h2>
          <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600 tabular-nums">
            {pending.length}
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
          <Link
            href={`/admin/tasks?department=${departmentId}`}
            className="text-[11px] font-semibold text-[#1e3a8a] hover:text-[#152978] inline-flex items-center gap-1"
          >
            Ver kanban
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {pending.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-[13px] text-slate-500">Sin tareas activas en este departamento.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="divide-y divide-slate-100">
              {sortedPending.slice(0, 10).map(t => {
                const overdueTask = t.due_at && new Date(t.due_at).getTime() < now
                return (
                  <Link
                    key={t.id}
                    href={`/admin/tasks?department=${departmentId}`}
                    className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <Flag className={`h-3.5 w-3.5 shrink-0 ${PRIORITY_FLAG[t.priority]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-slate-900 truncate">{t.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {t.due_at && (
                          <p className={`text-[11px] ${overdueTask ? "text-[#E42D2C] font-semibold" : "text-slate-400"}`}>
                            {overdueTask ? "Vencida " : "Vence "}{fmtRelative(t.due_at)}
                          </p>
                        )}
                        {t.owner && (
                          <span className="text-[11px] text-slate-500 truncate">· {t.owner}</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#1e3a8a] group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                )
              })}
              {pending.length > 10 && (
                <Link
                  href={`/admin/tasks?department=${departmentId}`}
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-[11px] font-semibold text-slate-500 hover:text-[#1e3a8a] hover:bg-slate-50"
                >
                  Ver las {pending.length - 10} restantes
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      {/* MIEMBROS DEL DEPTO ──────────────────────────────────────────────── */}
      {members.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Users2 className="h-3.5 w-3.5 text-[#1e3a8a]" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">
              Equipo
            </h2>
            <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600 tabular-nums">
              {members.length}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {members.map(m => {
              const initials = (m.full_name || m.email || "?")
                .split(/[\s@]/).map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                    style={{ backgroundColor: dept.color }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">
                      {m.full_name ?? "Sin nombre"}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{m.email ?? "—"}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
