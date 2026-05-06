"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  Activity, Loader2, RefreshCw, ListTodo, MessageSquare, CheckCircle2,
  Plus, Users2, ArrowRight, Filter, AlertCircle,
} from "lucide-react"

interface ActivityItem {
  id:         string
  kind:       "task_created" | "task_updated" | "task_comment" | "task_status" | "persona_created"
  timestamp:  string
  actor:      string | null
  actor_name: string | null
  title:      string
  body:       string | null
  href:       string | null
  meta:       Record<string, any>
}

const KIND_META: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  task_created:    { icon: Plus,           color: "text-[#1e3a8a]",  bg: "bg-[#1e3a8a]/[0.08]",  label: "Tarea creada" },
  task_updated:    { icon: ListTodo,       color: "text-slate-600",  bg: "bg-slate-100",         label: "Actualización" },
  task_comment:    { icon: MessageSquare,  color: "text-amber-700",  bg: "bg-amber-50",          label: "Comentario" },
  task_status:     { icon: CheckCircle2,   color: "text-emerald-700", bg: "bg-emerald-50",       label: "Cambio de estado" },
  persona_created: { icon: Users2,         color: "text-[#E42D2C]",  bg: "bg-[#E42D2C]/[0.08]",  label: "Persona agendada" },
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1)  return "ahora"
  if (min < 60) return `hace ${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24)  return `hace ${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7)  return `hace ${day}d`
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

function fmtDayHeader(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86400_000)
  if (d.toDateString() === today.toDateString())     return "Hoy"
  if (d.toDateString() === yesterday.toDateString()) return "Ayer"
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
}

function initials(s: string) {
  return s.split(/[\s@]/).map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
}

const FILTERS: { k: string; label: string }[] = [
  { k: "all",     label: "Todo" },
  { k: "tasks",   label: "Tareas" },
  { k: "comments", label: "Comentarios" },
  { k: "personas", label: "Personas" },
]

export function ActivityView() {
  const [items,   setItems]   = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<string>("all")

  const fetchActivity = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) return
      const res = await fetch("/api/admin/activity?days=30&limit=200", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const j = await res.json()
        setItems(j.items ?? [])
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchActivity() }, [fetchActivity])

  const filtered = useMemo(() => {
    if (filter === "all")      return items
    if (filter === "tasks")    return items.filter(i => i.kind === "task_created" || i.kind === "task_updated" || i.kind === "task_status")
    if (filter === "comments") return items.filter(i => i.kind === "task_comment")
    if (filter === "personas") return items.filter(i => i.kind === "persona_created")
    return items
  }, [items, filter])

  // Group by day
  const groups = useMemo(() => {
    const m = new Map<string, ActivityItem[]>()
    filtered.forEach(i => {
      const dayKey = i.timestamp.slice(0, 10)
      const arr = m.get(dayKey) ?? []
      arr.push(i)
      m.set(dayKey, arr)
    })
    return Array.from(m.entries())
  }, [filtered])

  // Decide if we need virtualization (only kicks in for > 100 items)
  const useVirtualization = filtered.length > 100

  // Flatten groups into a single list with type tags for the virtualized renderer.
  type Row = { type: "header"; dayKey: string; count: number } | { type: "item"; item: ActivityItem }
  const flatRows = useMemo<Row[]>(() => {
    if (!useVirtualization) return []
    const rows: Row[] = []
    for (const [dayKey, list] of groups) {
      rows.push({ type: "header", dayKey, count: list.length })
      for (const item of list) rows.push({ type: "item", item })
    }
    return rows
  }, [groups, useVirtualization])

  // Virtualizer
  const parentRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => flatRows[i]?.type === "header" ? 56 : 84,
    overscan: 8,
  })

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a8a] tracking-tight">Actividad</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Últimos 30 días — {filtered.length} eventos
          </p>
        </div>
        <button
          onClick={fetchActivity}
          disabled={loading}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all disabled:opacity-40"
          title="Refrescar"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
        <Filter className="h-3.5 w-3.5 text-slate-400" />
        {FILTERS.map(f => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            className={`inline-flex items-center gap-1.5 h-8 rounded-full border px-3 text-[12px] font-medium transition-colors ${
              filter === f.k
                ? "border-[#1e3a8a]/30 bg-[#1e3a8a]/[0.06] text-[#1e3a8a]"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200 mb-4">
            <Activity className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-[15px] font-semibold text-slate-700">Sin actividad</p>
          <p className="text-[13px] text-slate-400 mt-1">No hay eventos en los últimos 30 días.</p>
        </div>
      ) : useVirtualization ? (
        // ─── Virtualized rendering (>100 items) ───────────────────────
        <div
          ref={parentRef}
          className="overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          style={{ height: "calc(100vh - 320px)", minHeight: 400 }}
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map(vi => {
              const row = flatRows[vi.index]
              if (!row) return null
              const style = {
                position: "absolute" as const,
                top:      0,
                left:     0,
                right:    0,
                transform: `translateY(${vi.start}px)`,
                height:   `${vi.size}px`,
              }
              if (row.type === "header") {
                return (
                  <div key={`h-${row.dayKey}`} style={style} className="flex items-center gap-3 px-5 pt-4 pb-2 bg-white border-b border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 capitalize">
                      {fmtDayHeader(row.dayKey)}
                    </p>
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[10.5px] text-slate-400 tabular-nums">{row.count}</span>
                  </div>
                )
              }
              const item = row.item
              const meta = KIND_META[item.kind] ?? KIND_META.task_updated
              const Icon = meta.icon
              return (
                <Link
                  key={item.id}
                  href={item.href ?? "#"}
                  style={style}
                  className="group flex items-start gap-3 px-5 py-3.5 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-slate-200 ${meta.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[12.5px] font-bold text-slate-900">{item.title}</p>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${meta.bg} ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                    {item.body && (
                      <p className="text-[12px] text-slate-600 mt-0.5 line-clamp-2 leading-snug">{item.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {item.actor && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-500 font-medium" title={item.actor}>
                          <span className="flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white bg-gradient-to-br from-[#E42D2C] to-[#1e3a8a] text-[7.5px] font-bold text-white">
                            {initials(item.actor_name ?? item.actor)}
                          </span>
                          {item.actor_name ?? item.actor}
                        </span>
                      )}
                      <span className="text-[10.5px] text-slate-400">{fmtRelative(item.timestamp)}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#1e3a8a] group-hover:translate-x-0.5 transition-all mt-1.5" />
                </Link>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([dayKey, list]) => (
            <div key={dayKey}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1e3a8a]/70 capitalize">
                  {fmtDayHeader(dayKey)}
                </p>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10.5px] text-slate-400 tabular-nums">
                  {list.length}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {list.map(item => {
                    const meta = KIND_META[item.kind] ?? KIND_META.task_updated
                    const Icon = meta.icon
                    return (
                      <Link
                        key={item.id}
                        href={item.href ?? "#"}
                        className="group flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-slate-200 ${meta.bg}`}>
                          <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[12.5px] font-bold text-slate-900">{item.title}</p>
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${meta.bg} ${meta.color}`}>
                              {meta.label}
                            </span>
                          </div>
                          {item.body && (
                            <p className="text-[12px] text-slate-600 mt-0.5 line-clamp-2 leading-snug">
                              {item.body}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {item.actor && (
                              <span
                                className="inline-flex items-center gap-1 text-[10.5px] text-slate-500 font-medium"
                                title={item.actor}
                              >
                                <span className="flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white bg-gradient-to-br from-[#E42D2C] to-[#1e3a8a] text-[7.5px] font-bold text-white">
                                  {initials(item.actor_name ?? item.actor)}
                                </span>
                                {item.actor_name ?? item.actor}
                              </span>
                            )}
                            <span className="text-[10.5px] text-slate-400">
                              {fmtRelative(item.timestamp)}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#1e3a8a] group-hover:translate-x-0.5 transition-all mt-1.5" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
