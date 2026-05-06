"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import {
  Bell, Check, CheckCheck, Loader2, X, ListTodo, MessageSquare, AlertCircle,
} from "lucide-react"
import { createClient } from "@/lib/supabase"

interface Notification {
  id:         string
  recipient:  string
  kind:       "task_assigned" | "task_mention" | "task_overdue" | "system"
  title:      string
  body:       string | null
  href:       string | null
  payload:    any
  read_at:    string | null
  created_at: string
}

const KIND_ICON: Record<string, any> = {
  task_assigned: ListTodo,
  task_mention:  MessageSquare,
  task_overdue:  AlertCircle,
  system:        Bell,
}

const KIND_COLOR: Record<string, string> = {
  task_assigned: "bg-[#1e3a8a]/[0.08] text-[#1e3a8a]",
  task_mention:  "bg-amber-50 text-amber-700",
  task_overdue:  "bg-red-50 text-[#E42D2C]",
  system:        "bg-slate-50 text-slate-600",
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

export function NotificationsBell() {
  const [open,         setOpen]         = useState(false)
  const [items,        setItems]        = useState<Notification[]>([])
  const [unreadCount,  setUnreadCount]  = useState(0)
  const [loading,      setLoading]      = useState(false)
  const [tab,          setTab]          = useState<"unread" | "all">("unread")
  const [available,    setAvailable]    = useState(true)
  const ref = useRef<HTMLDivElement | null>(null)

  const getSession = async () => {
    const { data: { session } } = await createClient().auth.getSession()
    return session
  }

  const fetchNotifs = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      const url = tab === "unread"
        ? "/api/admin/notifications?unread=1&limit=50"
        : "/api/admin/notifications?limit=50"
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const j = await res.json()
        setItems(j.notifications ?? [])
        setUnreadCount(j.unreadCount ?? 0)
        setAvailable(true)
      } else if (res.status === 500 || res.status === 404) {
        // Likely the migration hasn't been applied yet — silently disable.
        setAvailable(false)
      }
    } catch {
      setAvailable(false)
    } finally { setLoading(false) }
  }, [tab])

  // Load count on mount; refresh every 60s
  useEffect(() => {
    fetchNotifs()
    const id = setInterval(fetchNotifs, 60_000)
    return () => clearInterval(id)
  }, [fetchNotifs])

  // Click-outside / Escape close
  useEffect(() => {
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onMouse)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onMouse)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  const markRead = async (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    setUnreadCount(c => Math.max(0, c - 1))
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/notifications", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id }),
    })
  }

  const markAllRead = async () => {
    setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    setUnreadCount(0)
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/notifications", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ all: true }),
    })
  }

  // Hide the bell entirely if the migration hasn't been applied
  if (!available) return null

  const visible = tab === "unread" ? items.filter(n => !n.read_at) : items

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifs() }}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-[#1e3a8a] transition-colors"
        aria-label="Notificaciones"
        title={unreadCount > 0 ? `${unreadCount} sin leer` : "Notificaciones"}
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E42D2C] px-1 text-[9px] font-bold text-white tabular-nums ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.10)] z-50">

          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#1e3a8a]" />
              <p className="text-[13px] font-bold text-slate-900">Notificaciones</p>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#E42D2C]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#E42D2C] tabular-nums">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-[#1e3a8a] transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                Marcar todas leídas
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 px-4">
            {[
              { k: "unread" as const, label: "Sin leer", n: unreadCount },
              { k: "all" as const,    label: "Todas",    n: null },
            ].map(t => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors border-b-2 ${
                  tab === t.k
                    ? "border-[#E42D2C] text-slate-900"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {t.label}
                {t.n !== null && t.n > 0 && (
                  <span className="rounded-full bg-slate-100 px-1.5 text-[9px] font-bold text-slate-600">{t.n}</span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
            ) : visible.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200 mx-auto mb-2">
                  <Check className="h-4 w-4 text-slate-400" />
                </div>
                <p className="text-[12px] font-semibold text-slate-700">
                  {tab === "unread" ? "Estás al día" : "Sin notificaciones"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {tab === "unread" ? "No hay nada sin leer." : "Tampoco hay leídas."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visible.map(n => {
                  const Icon = KIND_ICON[n.kind] ?? Bell
                  const colorCls = KIND_COLOR[n.kind] ?? "bg-slate-50 text-slate-600"
                  const unread = !n.read_at
                  return (
                    <Link
                      key={n.id}
                      href={n.href ?? "#"}
                      onClick={() => { if (unread) markRead(n.id); setOpen(false) }}
                      className={`group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${
                        unread ? "bg-[#1e3a8a]/[0.02]" : ""
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-slate-200 ${colorCls}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[12.5px] font-bold text-slate-900 truncate">{n.title}</p>
                          {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E42D2C]" />}
                        </div>
                        {n.body && (
                          <p className="text-[11.5px] text-slate-500 mt-0.5 line-clamp-2 leading-snug">{n.body}</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">{fmtRelative(n.created_at)}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
