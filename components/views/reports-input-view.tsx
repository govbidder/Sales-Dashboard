"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { exportToCSV } from "@/lib/export-csv"
import { CsvImportModal } from "@/components/ui/csv-import-modal"
import { useToast } from "@/components/ui/toast"
import {
  Loader2, Save, RefreshCw, Trash2, ChevronDown, ChevronUp,
  DollarSign, TrendingUp, Megaphone, FileSearch, Check, AlertCircle,
  Download, Upload,
} from "lucide-react"

// ─── Schema (must match API NUMERIC_FIELDS + TEXT_FIELDS) ─────────────────────

type FieldDef = { key: string; label: string; type: "money" | "number" | "text"; placeholder?: string }
type Section  = { id: string; title: string; icon: any; fields: FieldDef[] }

const SECTIONS: Section[] = [
  {
    id: "revenue",
    title: "Revenue & Costos",
    icon: DollarSign,
    fields: [
      { key: "cash_collected", label: "Cobrado",  type: "money" },
      { key: "total_revenue",  label: "Ingresos Totales",   type: "money" },
      { key: "mrr",            label: "MRR",             type: "money" },
      { key: "ad_spend",       label: "Gasto en Ads",        type: "money" },
      { key: "software_costs", label: "Software Costs",  type: "money" },
      { key: "variable_costs", label: "Variable Costs",  type: "money" },
    ],
  },
  {
    id: "sales",
    title: "Pipeline de Ventas",
    icon: TrendingUp,
    fields: [
      { key: "scheduled_calls",      label: "Calls Agendadas",      type: "number" },
      { key: "attended_calls",       label: "Llamadas Atendidas",      type: "number" },
      { key: "qualified_calls",      label: "Calls Calificadas",    type: "number" },
      { key: "no_show",              label: "No Shows",             type: "number" },
      { key: "open_conversations",   label: "Conversaciones Abiertas", type: "number" },
      { key: "aplications",          label: "Aplicaciones",         type: "number" },
      { key: "inbound_messages",     label: "Mensajes Inbound",     type: "number" },
      { key: "offer_docs_sent",      label: "Offer Docs Enviados",  type: "number" },
      { key: "offer_docs_responded", label: "Offer Docs Respondidos", type: "number" },
      { key: "cierres_por_offerdoc", label: "Cierres por OfferDoc", type: "number" },
      { key: "new_clients",          label: "Nuevos Clientes",      type: "number" },
      { key: "active_clients",       label: "Clientes Activos",     type: "number" },
    ],
  },
  {
    id: "marketing",
    title: "Marketing (Audiencia)",
    icon: Megaphone,
    fields: [
      { key: "short_followers",      label: "Seguidores IG/TikTok", type: "number" },
      { key: "short_reach",          label: "Reach mensual",        type: "number" },
      { key: "short_posts",          label: "Posts publicados",     type: "number" },
      { key: "yt_subscribers",       label: "Suscriptores YouTube", type: "number" },
      { key: "yt_new_subscribers",   label: "Nuevos subs YT",       type: "number" },
      { key: "yt_views",             label: "Views YT",             type: "number" },
      { key: "yt_videos",            label: "Videos publicados",    type: "number" },
      { key: "email_subscribers",    label: "Subs Email",           type: "number" },
      { key: "email_new_subscribers",label: "Nuevos subs email",    type: "number" },
    ],
  },
  {
    id: "reflection",
    title: "Reflexión del Mes",
    icon: FileSearch,
    fields: [
      { key: "biggest_win",    label: "Mayor logro del mes",   type: "text", placeholder: "¿Qué salió mejor de lo esperado?" },
      { key: "next_focus",     label: "Próximo foco",          type: "text", placeholder: "¿En qué nos enfocamos el mes que viene?" },
      { key: "support_needed", label: "Apoyo que necesitamos", type: "text", placeholder: "¿Qué ayuda precisamos?" },
      { key: "improvements",   label: "Qué mejorar",           type: "text", placeholder: "Aprendizajes / cambios" },
      { key: "nps_score",      label: "NPS Score (0-10)",      type: "number" },
    ],
  },
]

// All numeric keys in one set for type-safe blank values
const NUMERIC_KEYS = new Set(SECTIONS.flatMap(s => s.fields.filter(f => f.type !== "text").map(f => f.key)))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonthLabel(m: string) {
  const ym = m.slice(0, 7)
  const [y, mm] = ym.split("-")
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  return `${names[parseInt(mm, 10) - 1] ?? mm} ${y}`
}
function fmtDateTime(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}
function getCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a]/40 focus:outline-none transition-all tabular-nums"

// ─── Form ─────────────────────────────────────────────────────────────────────

function ReportForm({
  initialMonth, initialReport, allMonths, onSaved,
}: {
  initialMonth:  string
  initialReport: any | null
  allMonths:     string[]
  onSaved:       (r: any) => void
}) {
  const [month,    setMonth]    = useState(initialMonth)
  const [values,   setValues]   = useState<Record<string, any>>({})
  const [collapsed,setCollapsed]= useState<Record<string, boolean>>({ marketing: true })
  const [saving,   setSaving]   = useState(false)
  const [status,   setStatus]   = useState<"idle" | "success" | "error">("idle")
  const [message,  setMessage]  = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  const isUpdate = useMemo(
    () => allMonths.includes(month.length === 7 ? `${month}-01` : month),
    [month, allMonths]
  )

  // Fetch report when month changes
  const loadMonth = useCallback(async (m: string) => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/admin/reports?month=${m}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setValues(json.report ?? {})
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (initialReport) setValues(initialReport)
    else loadMonth(initialMonth)
  }, [initialMonth, initialReport, loadMonth])

  useEffect(() => {
    loadMonth(month)
    setStatus("idle")
    setMessage(null)
  }, [month, loadMonth])

  const setField = (k: string, v: any) => {
    setValues(prev => ({ ...prev, [k]: v }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setStatus("idle")
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Build payload
      const payload: Record<string, any> = { month }
      for (const sec of SECTIONS) for (const f of sec.fields) {
        const v = values[f.key]
        if (v == null || v === "") payload[f.key] = null
        else if (NUMERIC_KEYS.has(f.key)) {
          const n = Number(v)
          payload[f.key] = Number.isFinite(n) ? n : null
        } else {
          payload[f.key] = String(v)
        }
      }

      const res = await fetch("/api/admin/reports", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Error guardando")

      setStatus("success")
      setMessage(isUpdate ? "Reporte actualizado" : "Reporte creado")
      onSaved(json.report)
      setTimeout(() => { setStatus("idle"); setMessage(null) }, 4000)
    } catch (e: any) {
      setStatus("error")
      setMessage(e?.message ?? "Error")
    } finally { setSaving(false) }
  }

  const toggle = (id: string) => setCollapsed(p => ({ ...p, [id]: !p[id] }))

  const renderField = (f: FieldDef) => {
    const v = values[f.key]
    if (f.type === "text") {
      return (
        <textarea
          key={f.key}
          value={v ?? ""}
          onChange={e => setField(f.key, e.target.value)}
          placeholder={f.placeholder}
          rows={3}
          className={`${inputCls} resize-none`}
        />
      )
    }
    return (
      <input
        key={f.key}
        type="number"
        step={f.type === "money" ? "0.01" : "1"}
        value={v ?? ""}
        onChange={e => setField(f.key, e.target.value)}
        placeholder={f.type === "money" ? "$ 0" : "0"}
        className={inputCls}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Month + status header */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">Mes</p>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-[#1e3a8a]/40"
          />
        </div>

        <div className="flex items-center gap-2">
          {isUpdate ? (
            <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-bold text-amber-700 uppercase tracking-wide">
              Actualizando existente
            </span>
          ) : (
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-700 uppercase tracking-wide">
              Nuevo reporte
            </span>
          )}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
      </div>

      {/* Sections */}
      {SECTIONS.map(sec => {
        const isCollapsed = collapsed[sec.id]
        const Icon = sec.icon
        return (
          <div key={sec.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(sec.id)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E42D2C]/10 ring-1 ring-[#E42D2C]/20">
                  <Icon className="h-4 w-4 text-[#E42D2C]" />
                </span>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">{sec.title}</h3>
              </div>
              {isCollapsed ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
            </button>

            {!isCollapsed && (
              <div className="border-t border-slate-100 px-5 py-4">
                <div className={`grid gap-3 ${sec.id === "reflection" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
                  {sec.fields.map(f => (
                    <div key={f.key} className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">{f.label}</p>
                      {renderField(f)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Submit row */}
      <div className="sticky bottom-4 z-10">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md px-5 py-3 shadow-2xl">
          {message && (
            <div className={`flex items-center gap-2 text-[13px] ${status === "success" ? "text-emerald-700" : status === "error" ? "text-red-700" : "text-slate-600"}`}>
              {status === "success" && <Check className="h-4 w-4" />}
              {status === "error"   && <AlertCircle className="h-4 w-4" />}
              {message}
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="ml-auto flex items-center gap-2 h-10 rounded-xl bg-[#E42D2C] px-5 text-sm font-bold text-white hover:bg-[#c42423] disabled:opacity-40 transition-all"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isUpdate ? "Actualizar reporte" : "Guardar reporte"}
          </button>
        </div>
      </div>
    </form>
  )
}

// ─── History sub-view ─────────────────────────────────────────────────────────

function HistoryView({ reports, onPick, onDelete, deletingId }: {
  reports: any[]
  onPick: (m: string) => void
  onDelete: (id: string) => void
  deletingId: string | null
}) {
  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
        <p className="text-sm text-slate-400">Todavía no hay reportes cargados.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["Mes","Cobrado","Revenue","MRR","Cierres","NPS","Última edición",""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map(r => {
              const fmtMoney = (n: any) => n != null ? `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"
              return (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => onPick(String(r.month).slice(0, 7))}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-[14px] font-semibold text-slate-900">
                    {fmtMonthLabel(r.month)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[13px] tabular-nums text-emerald-700/80">
                    {fmtMoney(r.cash_collected)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[13px] tabular-nums text-slate-800">
                    {fmtMoney(r.total_revenue)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[13px] tabular-nums text-slate-600">
                    {fmtMoney(r.mrr)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[13px] tabular-nums text-slate-600">
                    {r.new_clients ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[13px] tabular-nums text-slate-600">
                    {r.nps_score != null ? Number(r.nps_score).toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[12px] text-slate-500">
                    {fmtDateTime(r.updated_at ?? r.created_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-500/10 transition-all disabled:opacity-40"
                    >
                      {deletingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

// CSV template content — todos los campos requeridos + 1 fila de ejemplo coherente.
// IMPORTANT: si cambiás los headers acá, sincronizá los aliases del CsvImportModal abajo
// y los campos del Zod schema en /api/admin/reports/bulk.
const CSV_TEMPLATE_HEADERS = [
  "month", "year",
  "scheduled_calls", "attended_calls", "aplications", "new_clients",
  "offer_docs_sent", "offer_docs_responded", "cierres_por_offerdoc",
  "cash_collected", "total_revenue", "mrr",
] as const

const CSV_TEMPLATE_EXAMPLE_ROW = {
  month: 1, year: 2026,
  scheduled_calls: 45, attended_calls: 38, aplications: 120, new_clients: 12,
  offer_docs_sent: 25, offer_docs_responded: 15, cierres_por_offerdoc: 6,
  cash_collected: 18000, total_revenue: 22000, mrr: 12000,
}

export function ReportsInputView() {
  const [tab,        setTab]        = useState<"form" | "history">("form")
  const [month,      setMonth]      = useState(getCurrentMonth())
  const [reports,    setReports]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const toast = useToast()

  const getSession = async () => {
    const { data: { session } } = await createClient().auth.getSession()
    return session
  }

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch("/api/admin/reports", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) setReports((await res.json()).reports ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  const allMonths = useMemo(() => reports.map(r => String(r.month).slice(0, 10)), [reports])

  const handleSaved = (r: any) => {
    setReports(prev => {
      const m = String(r.month).slice(0, 10)
      const idx = prev.findIndex(x => String(x.month).slice(0, 10) === m)
      if (idx === -1) return [r, ...prev].sort((a, b) => String(b.month).localeCompare(String(a.month)))
      const copy = [...prev]; copy[idx] = r
      return copy
    })
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/reports", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id }),
    })
    setReports(prev => prev.filter(r => r.id !== id))
    setDeletingId(null)
  }

  // ─── CSV template + bulk import ─────────────────────────────────────────────

  const handleDownloadTemplate = () => {
    exportToCSV([CSV_TEMPLATE_EXAMPLE_ROW], "monthly_reports_template.csv", {
      columns: CSV_TEMPLATE_HEADERS.map(h => ({ key: h, header: h })),
    })
  }

  const handleBulkImport = async (rows: Record<string, any>[]) => {
    const session = await getSession()
    if (!session) return { inserted: 0, failed: rows.length, errors: ["Sesión expirada"] }
    const res = await fetch("/api/admin/reports/bulk", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ reports: rows }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { inserted: 0, failed: rows.length, errors: [j?.error ?? "Error en el servidor"] }
    }
    const inserted: number = j.inserted ?? 0
    const updated:  number = j.updated  ?? 0
    const serverErrors: { index: number; error: string }[] = j.errors ?? []
    await fetchReports()
    toast.success(`${inserted} reportes importados, ${updated} actualizados`)
    return {
      inserted: inserted + updated,
      failed:   serverErrors.length,
      errors:   serverErrors.map(e => `Fila ${e.index + 1}: ${e.error}`),
    }
  }

  return (
    <div className="space-y-6">

      {showImport && (
        <CsvImportModal
          title="Importar reportes mensuales"
          description="Cada fila se inserta como un reporte. Si ya existe uno para ese mes, se actualiza."
          templateCSV={
            CSV_TEMPLATE_HEADERS.join(",") + "\n" +
            CSV_TEMPLATE_HEADERS.map(h => (CSV_TEMPLATE_EXAMPLE_ROW as any)[h]).join(",") + "\n"
          }
          columns={[
            // Required
            { field: "month", label: "Mes (1-12)", required: true,
              aliases: ["mes"],
              transform: v => parseInt(v.trim(), 10) },
            { field: "year",  label: "Año",         required: true,
              aliases: ["ano", "año"],
              transform: v => parseInt(v.trim(), 10) },
            // Optional numerics
            { field: "scheduled_calls",      label: "Llamadas agendadas",
              aliases: ["llamadas_agendadas", "agendadas"],
              transform: v => Number(v) },
            { field: "attended_calls",       label: "Llamadas atendidas",
              aliases: ["llamadas_atendidas", "atendidas"],
              transform: v => Number(v) },
            { field: "aplications",          label: "Aplicaciones",
              transform: v => Number(v) },
            { field: "new_clients",          label: "Nuevos clientes",
              transform: v => Number(v) },
            { field: "offer_docs_sent",      label: "Offer docs enviados",
              transform: v => Number(v) },
            { field: "offer_docs_responded", label: "Offer docs respondidos",
              transform: v => Number(v) },
            { field: "cierres_por_offerdoc", label: "Cierres por offer doc",
              transform: v => Number(v) },
            { field: "cash_collected",       label: "Cobrado",
              aliases: ["ingresos"],
              transform: v => Number(v) },
            { field: "total_revenue",        label: "Facturación",
              aliases: ["facturacion", "revenue"],
              transform: v => Number(v) },
            { field: "mrr",                  label: "MRR",
              transform: v => Number(v) },
          ]}
          onClose={() => setShowImport(false)}
          onImport={async (rows) => {
            // Validación cliente: month 1-12, year 2020-2030, métricas >= 0.
            const errors: string[] = []
            const validRows: Record<string, any>[] = []
            rows.forEach((r, i) => {
              const monthN = Number(r.month)
              const yearN  = Number(r.year)
              if (!Number.isInteger(monthN) || monthN < 1 || monthN > 12) {
                errors.push(`Fila ${i + 1}: mes inválido (${r.month}). Debe ser 1-12.`); return
              }
              if (!Number.isInteger(yearN) || yearN < 2020 || yearN > 2030) {
                errors.push(`Fila ${i + 1}: año inválido (${r.year}). Debe ser 2020-2030.`); return
              }
              const clean: Record<string, any> = { month: monthN, year: yearN }
              let rowBad = false
              for (const k of Object.keys(r)) {
                if (k === "month" || k === "year") continue
                const v = r[k]
                if (v == null || v === "") continue
                const n = Number(v)
                if (!Number.isFinite(n) || n < 0) {
                  errors.push(`Fila ${i + 1}: ${k} inválido (${v}). Debe ser número >= 0.`)
                  rowBad = true
                  break
                }
                clean[k] = n
              }
              if (!rowBad) validRows.push(clean)
            })

            if (validRows.length === 0) {
              return { inserted: 0, failed: rows.length, errors }
            }

            const serverRes = await handleBulkImport(validRows)
            return {
              inserted: serverRes.inserted,
              failed:   rows.length - serverRes.inserted,
              errors:   [...errors, ...serverRes.errors],
            }
          }}
        />
      )}

      {/* Header + tabs */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a8a] tracking-tight">Métricas Mensuales</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Cargá los KPIs del mes para ver el dashboard alimentado.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadTemplate}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900 transition-all"
            title="Descargar CSV template con los campos esperados"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar template
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[#1e3a8a]/30 bg-[#1e3a8a]/[0.06] px-3 text-[12px] font-semibold text-[#1e3a8a] hover:border-[#1e3a8a]/50 hover:bg-[#1e3a8a]/[0.10] transition-all"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar CSV
          </button>

          <div className="inline-flex h-9 rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={() => setTab("form")}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all ${
                tab === "form" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
              }`}>
              Cargar
            </button>
            <button
              onClick={() => setTab("history")}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all ${
                tab === "history" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
              }`}>
              Historial ({reports.length})
            </button>
          </div>
        </div>
      </div>

      {tab === "form" ? (
        loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
          </div>
        ) : (
          <ReportForm
            initialMonth={month}
            initialReport={null}
            allMonths={allMonths}
            onSaved={handleSaved}
          />
        )
      ) : (
        <>
          <div className="flex items-center justify-end">
            <button onClick={fetchReports} disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all disabled:opacity-40">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <HistoryView
            reports={reports}
            onPick={m => { setMonth(m); setTab("form") }}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        </>
      )}
    </div>
  )
}
