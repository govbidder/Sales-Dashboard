"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import {
  Shield, Loader2, RefreshCw, AlertCircle, Info, Search, Filter,
} from "lucide-react"

interface AuditEntry {
  id:         string
  actor:      string | null
  actor_role: string | null
  action:     string
  entity:     string
  entity_id:  string | null
  payload:    Record<string, any>
  ip:         string | null
  user_agent: string | null
  created_at: string
}

const ENTITY_COLOR: Record<string, string> = {
  task:        "bg-[#1e3a8a]/[0.08] text-[#1e3a8a] border-[#1e3a8a]/20",
  task_form:   "bg-amber-50 text-amber-800 border-amber-200",
  persona:     "bg-[#E42D2C]/[0.08] text-[#E42D2C] border-[#E42D2C]/20",
  team_member: "bg-emerald-50 text-emerald-700 border-emerald-200",
  template:    "bg-purple-50 text-purple-700 border-purple-200",
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

function initials(s: string) {
  return s.split(/[\s@]/).map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
}

export function AuditLogView() {
  const [entries,     setEntries]     = useState<AuditEntry[]>([])
  const [loading,     setLoading]     = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [search,      setSearch]      = useState("")
  const [filterEnt,   setFilterEnt]   = useState<string>("")

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) return
      const url = new URL("/api/admin/audit-log", window.location.origin)
      url.searchParams.set("limit", "300")
      if (filterEnt) url.searchParams.set("entity", filterEnt)
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const j = await res.json()
      if (res.ok) {
        setEntries(j.entries ?? [])
        setUnavailable(Boolean(j.unavailable))
      }
    } finally { setLoading(false) }
  }, [filterEnt])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const filtered = useMemo(() => {
    if (!search.trim()) return entries
    const q = search.toLowerCase()
    return entries.filter(e =>
      [e.actor, e.action, e.entity, e.entity_id, JSON.stringify(e.payload)]
        .filter(Boolean)
        .some(s => String(s).toLowerCase().includes(q))
    )
  }, [entries, search])

  const entityOptions = useMemo(() => {
    const set = new Set<string>()
    entries.forEach(e => set.add(e.entity))
    return Array.from(set).sort()
  }, [entries])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a8a] tracking-tight flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Audit log
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Solo admins · {entries.length} acciones registradas
          </p>
        </div>
        <button
          onClick={fetchEntries}
          disabled={loading}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Migration warning */}
      {unavailable && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">El audit log requiere una migration.</p>
            <p className="mt-0.5">Aplicá <code className="bg-amber-100 px-1 rounded text-[11px]">supabase/migrations/20250506000002_audit_log.sql</code> en el SQL Editor de Supabase. Hasta entonces no se registra nada.</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-200 pb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por actor, acción, payload..."
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a]/40 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/10"
          />
        </div>
        <Filter className="h-3.5 w-3.5 text-slate-400" />
        <select
          value={filterEnt}
          onChange={e => setFilterEnt(e.target.value)}
          className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 outline-none cursor-pointer hover:border-slate-300"
        >
          <option value="">Todas las entidades</option>
          {entityOptions.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white py-20 text-center">
          <div className="pointer-events-none absolute -top-24 -right-24 h-[300px] w-[300px] rounded-full bg-[#E42D2C]/[0.06] blur-[100px]" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E42D2C]/10 ring-1 ring-[#E42D2C]/25 mb-4">
            <Shield className="h-6 w-6 text-[#ff6b6a]" />
          </span>
          <h3 className="relative text-[16px] font-bold text-slate-900 mb-1">
            {entries.length === 0 ? "No hay actividad registrada" : "Sin coincidencias"}
          </h3>
          <p className="relative max-w-sm text-[13px] text-slate-500 px-4">
            {entries.length === 0
              ? "Las acciones del equipo aparecerán acá."
              : "Probá ajustar el filtro o búsqueda."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-100">
            {filtered.map(e => (
              <div key={e.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E42D2C] to-[#1e3a8a] text-[10px] font-bold text-white ring-2 ring-white">
                  {initials(e.actor ?? "?")}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-slate-900">{e.actor ?? "(sistema)"}</span>
                    <span className="text-[12px] text-slate-500">→</span>
                    <span className="font-mono text-[11.5px] text-slate-700">{e.action}</span>
                    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ENTITY_COLOR[e.entity] ?? "border-slate-200 bg-slate-50 text-slate-600"}`}>
                      {e.entity}
                    </span>
                    {e.entity_id && (
                      <span className="font-mono text-[10.5px] text-slate-400">
                        {e.entity_id.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  {Object.keys(e.payload ?? {}).length > 0 && (
                    <details className="mt-1 group">
                      <summary className="cursor-pointer text-[10.5px] text-slate-400 group-hover:text-slate-600">
                        Ver payload
                      </summary>
                      <pre className="mt-1 rounded-md bg-slate-50 px-2 py-1.5 text-[10.5px] text-slate-600 overflow-x-auto">
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-[10.5px] text-slate-400">
                    <span>{fmtRelative(e.created_at)}</span>
                    {e.ip && <><span>·</span><span className="font-mono">{e.ip}</span></>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
