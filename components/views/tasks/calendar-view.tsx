"use client"

import { useMemo, useState } from "react"
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, addMonths, isSameMonth, isSameDay, isToday,
  parseISO, isWithinInterval, addDays,
} from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Flag, AlertCircle, Plus } from "lucide-react"

interface CalendarTask {
  id:        string
  title:     string
  status:    string
  priority:  "baja" | "media" | "alta" | "urgente"
  due_at:    string | null
  assignees: string[]
}

interface Props {
  tasks:        CalendarTask[]
  onTaskClick:  (id: string) => void
  onDayClick?:  (iso: string) => void  // for quick-create on a specific day
}

const PRIORITY_COLOR: Record<string, string> = {
  baja:    "bg-muted  text-muted-foreground  border-border",
  media:   "bg-amber-50   text-amber-800  border-amber-200",
  alta:    "bg-orange-50  text-orange-800 border-orange-200",
  urgente: "bg-red-50     text-red-800    border-red-200",
}

export function CalendarView({ tasks, onTaskClick, onDayClick }: Props) {
  const [cursor, setCursor] = useState<Date>(new Date())

  // Build calendar grid: weeks covering whole month
  const grid = useMemo(() => {
    const monthStart = startOfMonth(cursor)
    const monthEnd   = endOfMonth(cursor)
    const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 })   // Monday-start
    const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 1 })
    const days       = eachDayOfInterval({ start: gridStart, end: gridEnd })
    // Group into weeks
    const weeks: Date[][] = []
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
    return { weeks, monthStart, monthEnd }
  }, [cursor])

  // Index tasks by day-key (yyyy-MM-dd) for fast lookup
  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>()
    tasks.forEach(t => {
      if (!t.due_at) return
      const key = format(parseISO(t.due_at), "yyyy-MM-dd")
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    })
    return map
  }, [tasks])

  const overdueCount = useMemo(() => {
    const now = Date.now()
    return tasks.filter(t =>
      t.due_at && new Date(t.due_at).getTime() < now &&
      t.status !== "completada" && t.status !== "cancelada"
    ).length
  }, [tasks])

  const upcomingCount = useMemo(() => {
    const now    = new Date()
    const in7    = addDays(now, 7)
    return tasks.filter(t =>
      t.due_at && t.status !== "completada" && t.status !== "cancelada" &&
      isWithinInterval(parseISO(t.due_at), { start: now, end: in7 })
    ).length
  }, [tasks])

  const monthLabel = format(cursor, "MMMM yyyy", { locale: es })
  const weekDays   = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 bg-muted/40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCursor(c => addMonths(c, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-[#1e3a8a]/30 hover:text-[#1e3a8a] transition-colors"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-[15px] font-bold text-foreground capitalize min-w-[160px]">
            {monthLabel}
          </h2>
          <button
            onClick={() => setCursor(c => addMonths(c, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-[#1e3a8a]/30 hover:text-[#1e3a8a] transition-colors"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="ml-2 h-8 rounded-lg border border-border bg-card px-3 text-[12px] font-semibold text-muted-foreground hover:border-[#1e3a8a]/30 hover:text-[#1e3a8a] transition-colors"
          >
            Hoy
          </button>
        </div>

        {/* Stats chips */}
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">
              <AlertCircle className="h-3 w-3" />
              {overdueCount} vencidas
            </span>
          )}
          {upcomingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1e3a8a]/20 bg-[#1e3a8a]/5 px-2.5 py-1 text-[11px] font-bold text-[#1e3a8a]">
              {upcomingCount} próximas 7d
            </span>
          )}
        </div>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {weekDays.map(d => (
          <div key={d} className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 grid-rows-[repeat(auto-fill,minmax(120px,1fr))]">
        {grid.weeks.flat().map((day, idx) => {
          const dayKey   = format(day, "yyyy-MM-dd")
          const dayTasks = tasksByDay.get(dayKey) ?? []
          const inMonth  = isSameMonth(day, grid.monthStart)
          const today    = isToday(day)
          const isLastCol = (idx % 7) === 6
          const isLastRow = idx >= grid.weeks.length * 7 - 7

          return (
            <div
              key={dayKey}
              onClick={() => onDayClick?.(day.toISOString())}
              className={`relative group flex flex-col gap-1 px-2 py-2 min-h-[120px] cursor-pointer transition-colors
                ${isLastCol ? "" : "border-r"}
                ${isLastRow ? "" : "border-b"}
                border-border
                ${inMonth ? "bg-card hover:bg-muted/60" : "bg-muted/30 text-muted-foreground"}
              `}
            >
              {/* Day number */}
              <div className="flex items-center justify-between">
                <span className={`text-[12px] font-bold tabular-nums ${
                  today
                    ? "flex h-6 w-6 items-center justify-center rounded-full bg-[#E42D2C] text-white"
                    : inMonth
                      ? "text-muted-foreground px-1.5"
                      : "text-muted-foreground px-1.5"
                }`}>
                  {format(day, "d")}
                </span>
                {/* Quick-add (visible on hover) */}
                {onDayClick && inMonth && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDayClick(day.toISOString()) }}
                    className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-[#1e3a8a]/10 hover:text-[#1e3a8a] transition-all"
                    title="Crear tarea para este día"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Task chips */}
              <div className="flex flex-col gap-1 overflow-hidden">
                {dayTasks.slice(0, 3).map(t => {
                  const overdue = t.due_at && new Date(t.due_at).getTime() < Date.now()
                                  && t.status !== "completada" && t.status !== "cancelada"
                  const done    = t.status === "completada" || t.status === "cancelada"
                  return (
                    <button
                      key={t.id}
                      onClick={(e) => { e.stopPropagation(); onTaskClick(t.id) }}
                      className={`group/chip relative flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-left transition-all hover:shadow-sm ${
                        done
                          ? "border-border bg-muted text-muted-foreground line-through"
                          : overdue
                            ? "border-red-200 bg-red-50 text-red-800"
                            : PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.media
                      }`}
                    >
                      <Flag className={`h-2.5 w-2.5 shrink-0 ${
                        t.priority === "urgente" ? "text-red-600" :
                        t.priority === "alta"    ? "text-orange-600" :
                        t.priority === "media"   ? "text-amber-600" :
                                                   "text-muted-foreground"
                      }`} />
                      <span className="text-[10.5px] font-medium leading-tight truncate">
                        {t.title}
                      </span>
                    </button>
                  )
                })}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1.5">
                    + {dayTasks.length - 3} más
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
