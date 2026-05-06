"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, addMonths, isSameMonth, isToday, parseISO,
  addDays, isWithinInterval,
} from "date-fns"
import { es } from "date-fns/locale"
import {
  CalendarDays, ChevronLeft, ChevronRight, Loader2, RefreshCw,
  Users2, ListTodo, Flag, AlertCircle, ArrowRight,
} from "lucide-react"
import { createClient } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgendaItem {
  id:       string
  kind:     "task" | "persona"
  title:    string
  iso:      string             // when it happens
  href:     string              // where to navigate
  meta?:    string              // sub-line
  priority?: "baja" | "media" | "alta" | "urgente"
  status?:  string
  overdue?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

const PRIORITY_DOT: Record<string, string> = {
  baja:    "bg-zinc-400",
  media:   "bg-amber-500",
  alta:    "bg-orange-500",
  urgente: "bg-[#E42D2C]",
}

// ─── Calendar grid (month view) ──────────────────────────────────────────────

function MonthGrid({
  cursor, items, onItemClick,
}: {
  cursor: Date
  items: AgendaItem[]
  onItemClick: (item: AgendaItem) => void
}) {
  const grid = useMemo(() => {
    const ms = startOfMonth(cursor)
    const me = endOfMonth(cursor)
    const gs = startOfWeek(ms, { weekStartsOn: 1 })
    const ge = endOfWeek(me, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: gs, end: ge })
  }, [cursor])

  const byDay = useMemo(() => {
    const m = new Map<string, AgendaItem[]>()
    items.forEach(i => {
      const k = format(parseISO(i.iso), "yyyy-MM-dd")
      const arr = m.get(k) ?? []
      arr.push(i)
      m.set(k, arr)
    })
    return m
  }, [items])

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Week headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/40">
        {weekDays.map(d => (
          <div key={d} className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 text-center">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {grid.map((day, idx) => {
          const dk = format(day, "yyyy-MM-dd")
          const dayItems = (byDay.get(dk) ?? []).sort((a, b) => a.iso.localeCompare(b.iso))
          const inMonth = isSameMonth(day, cursor)
          const today = isToday(day)
          const isLastCol = (idx % 7) === 6
          const isLastRow = idx >= grid.length - 7

          return (
            <div
              key={dk}
              className={`flex flex-col gap-1 px-2 py-2 min-h-[120px] transition-colors
                ${isLastCol ? "" : "border-r"}
                ${isLastRow ? "" : "border-b"}
                border-slate-100
                ${inMonth ? "bg-white" : "bg-slate-50/30"}
              `}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[12px] font-bold tabular-nums ${
                  today
                    ? "flex h-6 w-6 items-center justify-center rounded-full bg-[#E42D2C] text-white"
                    : inMonth ? "text-slate-700 px-1.5" : "text-slate-400 px-1.5"
                }`}>
                  {format(day, "d")}
                </span>
                {dayItems.length > 3 && (
                  <span className="text-[10px] text-slate-400">+{dayItems.length - 3}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {dayItems.slice(0, 3).map(it => (
                  <button
                    key={it.id}
                    onClick={() => onItemClick(it)}
                    className={`group flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-left transition-all hover:shadow-sm ${
                      it.overdue
                        ? "border-red-200 bg-red-50 text-red-800"
                        : it.kind === "persona"
                          ? "border-[#1e3a8a]/20 bg-[#1e3a8a]/[0.04] text-[#1e3a8a]"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      it.kind === "persona"
                        ? "bg-[#1e3a8a]"
                        : it.priority ? PRIORITY_DOT[it.priority] : "bg-slate-400"
                    }`} />
                    <span className="text-[10px] font-bold tabular-nums shrink-0">
                      {fmtTime(it.iso)}
                    </span>
                    <span className="text-[10.5px] font-medium leading-tight truncate">
                      {it.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Upcoming list (next 7 days) ─────────────────────────────────────────────

function UpcomingList({ items }: { items: AgendaItem[] }) {
  const now    = new Date()
  const in7    = addDays(now, 7)
  const upcoming = items
    .filter(i => isWithinInterval(parseISO(i.iso), { start: now, end: in7 }))
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .slice(0, 12)

  if (!upcoming.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-8 text-center">
        <CalendarDays className="h-5 w-5 text-slate-400 mx-auto mb-2" />
        <p className="text-[13px] text-slate-500">No hay nada agendado para los próximos 7 días.</p>
      </div>
    )
  }

  // Group by day
  const groups = new Map<string, AgendaItem[]>()
  upcoming.forEach(i => {
    const k = format(parseISO(i.iso), "yyyy-MM-dd")
    const arr = groups.get(k) ?? []
    arr.push(i)
    groups.set(k, arr)
  })

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {Array.from(groups.entries()).map(([dayKey, list], gi, all) => {
        const day = parseISO(dayKey + "T00:00:00")
        const todayLabel = isToday(day)
          ? "Hoy"
          : format(day, "EEEE d 'de' MMMM", { locale: es })
        return (
          <div key={dayKey} className={gi === all.length - 1 ? "" : "border-b border-slate-100"}>
            <div className="px-5 py-2.5 bg-slate-50/50 border-b border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]/70 capitalize">
                {todayLabel}
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {list.map(it => (
                <Link
                  key={it.id}
                  href={it.href}
                  className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <span className="text-[11px] font-bold tabular-nums text-slate-500 w-12 shrink-0">
                    {fmtTime(it.iso)}
                  </span>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ${
                    it.kind === "persona"
                      ? "bg-[#1e3a8a]/[0.06] ring-[#1e3a8a]/20"
                      : "bg-slate-50 ring-slate-200"
                  }`}>
                    {it.kind === "persona"
                      ? <Users2 className="h-3.5 w-3.5 text-[#1e3a8a]" />
                      : <ListTodo className="h-3.5 w-3.5 text-slate-500" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-900 truncate">
                      {it.title}
                    </p>
                    {it.meta && (
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{it.meta}</p>
                    )}
                  </div>
                  {it.overdue && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      <AlertCircle className="h-2.5 w-2.5" /> vencida
                    </span>
                  )}
                  {it.priority && it.kind === "task" && !it.overdue && (
                    <span className={`flex items-center gap-1 text-[10px] font-bold ${
                      it.priority === "urgente" ? "text-[#E42D2C]" :
                      it.priority === "alta"    ? "text-orange-700" :
                      it.priority === "media"   ? "text-amber-700" :
                                                  "text-slate-400"
                    }`}>
                      <Flag className="h-2.5 w-2.5" />
                      {it.priority}
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#1e3a8a] group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function CalendarView() {
  const [cursor,  setCursor]  = useState(new Date())
  const [items,   setItems]   = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<"all" | "tasks" | "personas">("all")

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const headers = { Authorization: `Bearer ${session.access_token}` }

      const [tasksRes, personasRes] = await Promise.all([
        fetch("/api/admin/tasks", { headers }),
        fetch("/api/admin/personas", { headers }),
      ])

      const out: AgendaItem[] = []
      const now = Date.now()

      if (tasksRes.ok) {
        const tasks = (await tasksRes.json()).tasks ?? []
        for (const t of tasks) {
          if (!t.due_at) continue
          if (t.parent_id) continue
          const overdue = new Date(t.due_at).getTime() < now &&
                          t.status !== "completada" && t.status !== "cancelada"
          out.push({
            id: `task-${t.id}`,
            kind: "task",
            title: t.title,
            iso: t.due_at,
            href: "/admin/tasks",
            meta: (t.assignees ?? []).join(", ") || undefined,
            priority: t.priority,
            status: t.status,
            overdue,
          })
        }
      }

      if (personasRes.ok) {
        const personas = (await personasRes.json()).personas ?? []
        for (const p of personas) {
          if (!p.scheduled_at) continue
          out.push({
            id: `persona-${p.id}`,
            kind: "persona",
            title: p.name,
            iso: p.scheduled_at,
            href: "/admin/personas",
            meta: p.owner ?? undefined,
          })
        }
      }

      setItems(out)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = useMemo(() => {
    if (filter === "tasks")    return items.filter(i => i.kind === "task")
    if (filter === "personas") return items.filter(i => i.kind === "persona")
    return items
  }, [items, filter])

  const counts = {
    all:      items.length,
    tasks:    items.filter(i => i.kind === "task").length,
    personas: items.filter(i => i.kind === "persona").length,
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a8a] tracking-tight">Agenda</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {counts.tasks} {counts.tasks === 1 ? "tarea" : "tareas"} · {counts.personas} {counts.personas === 1 ? "persona" : "personas"} agendadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter chips */}
          <div className="inline-flex h-9 rounded-xl border border-slate-200 bg-white p-0.5">
            {([
              { k: "all" as const,      label: "Todo",     n: counts.all },
              { k: "tasks" as const,    label: "Tareas",   n: counts.tasks },
              { k: "personas" as const, label: "Personas", n: counts.personas },
            ]).map(f => (
              <button
                key={f.k}
                onClick={() => setFilter(f.k)}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all ${
                  filter === f.k
                    ? "bg-[#1e3a8a] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {f.label}
                <span className={`tabular-nums rounded-full px-1.5 text-[10px] ${
                  filter === f.k ? "bg-white/20" : "bg-slate-100"
                }`}>
                  {f.n}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all disabled:opacity-40"
            title="Refrescar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(c => addMonths(c, -1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#1e3a8a] transition-colors"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-[14px] font-bold text-slate-900 capitalize min-w-[140px] text-center">
            {format(cursor, "MMMM yyyy", { locale: es })}
          </h2>
          <button
            onClick={() => setCursor(c => addMonths(c, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#1e3a8a] transition-colors"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={() => setCursor(new Date())}
          className="text-[11px] font-semibold text-slate-500 hover:text-[#1e3a8a] transition-colors"
        >
          Hoy
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <MonthGrid
            cursor={cursor}
            items={filtered}
            onItemClick={(item) => { window.location.href = item.href }}
          />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-[#1e3a8a]" />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e3a8a]">
                Próximos 7 días
              </h3>
            </div>
            <UpcomingList items={filtered} />
          </div>
        </div>
      )}
    </div>
  )
}
