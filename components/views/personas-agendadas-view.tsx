"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Portal } from "@/components/ui/portal"
import { useToast } from "@/components/ui/toast"
import {
  Loader2, Trash2, RefreshCw, Download, X, Star, Plus,
  Instagram, ExternalLink, ChevronRight, Phone, Mail, Calendar as CalIcon,
  CheckCircle2, Circle, MessageCircle, Copy, Users2, Sparkles, Upload,
} from "lucide-react"
import { AiEmailModal } from "@/components/views/personas/ai-email-modal"
import { CsvImportModal } from "@/components/ui/csv-import-modal"

// ─── Types ────────────────────────────────────────────────────────────────────

const CALL_STATUS_OPTIONS = ["agendada", "atendida", "no_show", "cancelada", "reagendada"] as const
const SALES_STATUS_OPTIONS = ["pendiente", "propuesta", "cerrada", "perdida"] as const
const SEGUIMIENTO_TYPES = ["nota", "llamada", "mensaje", "email", "reunion"] as const

type CallStatus  = typeof CALL_STATUS_OPTIONS[number]
type SalesStatus = typeof SALES_STATUS_OPTIONS[number]
type SegType     = typeof SEGUIMIENTO_TYPES[number]

interface Persona {
  id:           string
  name:         string
  email:        string | null
  phone:        string | null
  instagram:    string | null
  scheduled_at: string | null
  call_status:  CallStatus
  sales_status: SalesStatus
  owner:        string | null
  source:       string | null
  rating:       number | null
  notes:        string | null
  created_at:   string
  updated_at:   string
}

interface Seguimiento {
  id:           string
  persona_id:   string
  type:         SegType
  content:      string | null
  completed:    boolean
  owner:        string | null
  due_at:       string | null
  completed_at: string | null
  created_at:   string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}
function fmtDateTime(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })
}
function toLocalInputValue(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

const CALL_STATUS_STYLE: Record<CallStatus, string> = {
  agendada:   "bg-blue-500/10   text-blue-700   border-blue-500/25",
  atendida:   "bg-emerald-500/10 text-emerald-700 border-emerald-500/25",
  no_show:    "bg-red-500/10    text-red-700    border-red-500/25",
  cancelada:  "bg-zinc-500/10   text-zinc-700   border-zinc-500/25",
  reagendada: "bg-amber-500/10  text-amber-700  border-amber-500/25",
}
const SALES_STATUS_STYLE: Record<SalesStatus, string> = {
  pendiente: "bg-slate-100   text-slate-600    border-slate-200",
  propuesta: "bg-amber-500/10   text-amber-700   border-amber-500/25",
  cerrada:   "bg-emerald-500/10 text-emerald-700 border-emerald-500/25",
  perdida:   "bg-red-500/10     text-red-700     border-red-500/25",
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({
  value, onChange, size = "sm",
}: {
  value:    number | null
  onChange: (n: number) => void
  size?:    "sm" | "md"
}) {
  const [hover, setHover] = useState<number | null>(null)
  const dim    = size === "md" ? "h-5 w-5" : "h-4 w-4"
  const active = hover ?? value ?? 0
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === value ? 0 : star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(null)}
          className="transition-transform hover:scale-110 focus:outline-none"
        >
          <Star className={`${dim} transition-colors ${
            star <= active ? "fill-amber-400 text-amber-600" : "fill-transparent text-slate-300"
          }`} />
        </button>
      ))}
    </div>
  )
}

// ─── Contact Actions ──────────────────────────────────────────────────────────

function normalizePhone(phone: string) {
  // Strip everything that isn't a digit or +. wa.me wants digits only.
  return phone.replace(/[^\d+]/g, "").replace(/^\+/, "")
}

function ContactActions({ persona }: { persona: Persona }) {
  const toast = useToast()
  const ig    = persona.instagram?.replace("@", "")
  const phone = persona.phone ? normalizePhone(persona.phone) : null

  const waText = encodeURIComponent(
    `Hola ${persona.name?.split(" ")[0] ?? ""}, te escribo de GovBidder por la llamada agendada.`
  )
  const mailSubject = encodeURIComponent(`Seguimiento — ${persona.name ?? ""}`)
  const mailBody    = encodeURIComponent(
    `Hola ${persona.name?.split(" ")[0] ?? ""},\n\nTe escribo para hacer seguimiento.\n\nSaludos.`
  )

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado`)
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  const hasAny = phone || persona.email || ig
  if (!hasAny) return null

  return (
    <div className="flex flex-wrap gap-2">
      {phone && (
        <>
          <a
            href={`https://wa.me/${phone}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 h-8 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-500/20 transition-colors"
            title="Mandar WhatsApp"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
          <button
            onClick={() => copy(persona.phone!, "Teléfono")}
            className="flex items-center gap-1.5 h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Copiar teléfono"
          >
            <Phone className="h-3.5 w-3.5" />
            Copiar tel
          </button>
        </>
      )}
      {persona.email && (
        <>
          <a
            href={`mailto:${persona.email}?subject=${mailSubject}&body=${mailBody}`}
            className="flex items-center gap-1.5 h-8 rounded-lg border border-blue-500/25 bg-blue-500/10 px-3 text-[12px] font-semibold text-blue-700 hover:bg-blue-500/20 transition-colors"
            title="Mandar email"
          >
            <Mail className="h-3.5 w-3.5" />
            Mail
          </a>
          <button
            onClick={() => copy(persona.email!, "Email")}
            className="flex items-center gap-1.5 h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Copiar email"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </button>
        </>
      )}
      {ig && (
        <a
          href={`https://instagram.com/${ig}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 h-8 rounded-lg border border-pink-500/25 bg-pink-500/10 px-3 text-[12px] font-semibold text-pink-700 hover:bg-pink-500/20 transition-colors"
          title="Ver Instagram"
        >
          <Instagram className="h-3.5 w-3.5" />
          @{ig}
        </a>
      )}
    </div>
  )
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  persona, seguimientos, onClose, onPatch, onDelete, deleting,
  onAddSeguimiento, onPatchSeguimiento, onDeleteSeguimiento,
}: {
  persona:             Persona
  seguimientos:        Seguimiento[]
  onClose:             () => void
  onPatch:             (id: string, updates: Partial<Persona>) => void
  onDelete:            (id: string) => void
  deleting:            boolean
  onAddSeguimiento:    (data: Partial<Seguimiento>) => Promise<void>
  onPatchSeguimiento:  (id: string, updates: Partial<Seguimiento>) => void
  onDeleteSeguimiento: (id: string) => void
}) {
  const ig = persona.instagram?.replace("@", "")
  const [showAiEmail, setShowAiEmail] = useState(false)

  const [newSegContent, setNewSegContent] = useState("")
  const [newSegType, setNewSegType] = useState<SegType>("nota")
  const [newSegDue, setNewSegDue] = useState("")
  const [savingSeg, setSavingSeg] = useState(false)

  const submitSeg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSegContent.trim()) return
    setSavingSeg(true)
    await onAddSeguimiento({
      persona_id: persona.id,
      type:       newSegType,
      content:    newSegContent.trim(),
      due_at:     newSegDue ? new Date(newSegDue).toISOString() : null,
    })
    setNewSegContent("")
    setNewSegDue("")
    setSavingSeg(false)
  }

  const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a]/40 focus:outline-none transition-all"

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/30" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-[110] flex w-full max-w-[480px] flex-col border-l border-slate-200 shadow-2xl" style={{ backgroundColor: "#ffffff" }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">{persona.name}</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Agregada {fmtDate(persona.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onDelete(persona.id)} disabled={deleting}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-500/10 transition-all disabled:opacity-40">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Status pills + rating row */}
          <div className="border-b border-slate-200 px-6 py-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <StarRating size="md" value={persona.rating}
                onChange={n => onPatch(persona.id, { rating: n || null })} />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={persona.call_status}
                onChange={e => onPatch(persona.id, { call_status: e.target.value as CallStatus })}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide outline-none cursor-pointer ${CALL_STATUS_STYLE[persona.call_status]}`}
              >
                {CALL_STATUS_OPTIONS.map(s => (
                  <option key={s} value={s} className="bg-white text-slate-900">{s}</option>
                ))}
              </select>
              <select
                value={persona.sales_status}
                onChange={e => onPatch(persona.id, { sales_status: e.target.value as SalesStatus })}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide outline-none cursor-pointer ${SALES_STATUS_STYLE[persona.sales_status]}`}
              >
                {SALES_STATUS_OPTIONS.map(s => (
                  <option key={s} value={s} className="bg-white text-slate-900">{s}</option>
                ))}
              </select>
            </div>

            {/* Quick contact actions */}
            <ContactActions persona={persona} />

            {/* AI email composer */}
            <button
              onClick={() => setShowAiEmail(true)}
              className="mt-2 inline-flex items-center gap-1.5 h-8 rounded-lg border border-[#1e3a8a]/25 bg-gradient-to-br from-[#E42D2C]/[0.05] to-[#1e3a8a]/[0.05] px-3 text-[12px] font-bold text-[#1e3a8a] hover:border-[#1e3a8a]/40 transition-colors"
              title="Redactar email personalizado con IA"
            >
              <Sparkles className="h-3 w-3" />
              Email con IA
            </button>
          </div>

          {showAiEmail && (
            <AiEmailModal
              personaId={persona.id}
              personaName={persona.name}
              personaEmail={persona.email}
              onClose={() => setShowAiEmail(false)}
            />
          )}

          {/* Editable fields */}
          <div className="px-6 py-5 space-y-4">

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Llamada agendada</p>
              <input
                type="datetime-local"
                defaultValue={toLocalInputValue(persona.scheduled_at)}
                onBlur={e => onPatch(persona.id, { scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Email</p>
                <input
                  type="email"
                  defaultValue={persona.email ?? ""}
                  placeholder="correo@..."
                  onBlur={e => onPatch(persona.id, { email: e.target.value || null })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Teléfono</p>
                <input
                  type="tel"
                  defaultValue={persona.phone ?? ""}
                  placeholder="+54..."
                  onBlur={e => onPatch(persona.id, { phone: e.target.value || null })}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Instagram</p>
                <input
                  type="text"
                  defaultValue={persona.instagram ?? ""}
                  placeholder="@usuario"
                  onBlur={e => onPatch(persona.id, { instagram: e.target.value || null })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">De dónde llegó</p>
                <input
                  type="text"
                  defaultValue={persona.source ?? ""}
                  placeholder="ej: Instagram, Referido..."
                  onBlur={e => onPatch(persona.id, { source: e.target.value || null })}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Owner (responsable)</p>
              <input
                type="text"
                defaultValue={persona.owner ?? ""}
                placeholder="Quien hace el seguimiento"
                onBlur={e => onPatch(persona.id, { owner: e.target.value || null })}
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Notas</p>
              <textarea
                defaultValue={persona.notes ?? ""}
                placeholder="Contexto, intereses, observaciones..."
                rows={4}
                onBlur={e => onPatch(persona.id, { notes: e.target.value || null })}
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>

          {/* Seguimientos timeline */}
          <div className="border-t border-slate-200 px-6 py-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-[3px] rounded-full bg-[#E42D2C]" />
              <h3 className="text-[12px] font-bold uppercase tracking-widest text-slate-600">Seguimientos</h3>
              <span className="text-[11px] text-slate-400">({seguimientos.length})</span>
            </div>

            {/* Add seguimiento form */}
            <form onSubmit={submitSeg} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <select
                  value={newSegType}
                  onChange={e => setNewSegType(e.target.value as SegType)}
                  className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[12px] text-slate-900 outline-none capitalize"
                >
                  {SEGUIMIENTO_TYPES.map(t => <option key={t} value={t} className="bg-white">{t}</option>)}
                </select>
                <input
                  type="datetime-local"
                  value={newSegDue}
                  onChange={e => setNewSegDue(e.target.value)}
                  placeholder="Vence el..."
                  className="h-8 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[12px] text-slate-700 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <input
                  value={newSegContent}
                  onChange={e => setNewSegContent(e.target.value)}
                  placeholder="¿Qué hay que hacer / qué pasó?"
                  className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none"
                />
                <button
                  type="submit"
                  disabled={!newSegContent.trim() || savingSeg}
                  className="h-9 rounded-lg bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] disabled:opacity-40 transition-all flex items-center gap-1.5"
                >
                  {savingSeg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Sumar
                </button>
              </div>
            </form>

            {/* List */}
            {seguimientos.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-slate-400">Sin seguimientos todavía.</p>
            ) : (
              <div className="space-y-2">
                {seguimientos.map(s => (
                  <div key={s.id} className={`rounded-xl border px-3 py-2.5 transition-all ${s.completed ? "border-slate-100 bg-slate-50 opacity-60" : "border-slate-200 bg-slate-50"}`}>
                    <div className="flex items-start gap-2.5">
                      <button
                        onClick={() => onPatchSeguimiento(s.id, { completed: !s.completed })}
                        className="mt-0.5 shrink-0 transition-transform hover:scale-110"
                      >
                        {s.completed
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          : <Circle className="h-4 w-4 text-slate-400 hover:text-slate-600" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 capitalize">
                            {s.type}
                          </span>
                          {s.due_at && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <CalIcon className="h-3 w-3" /> {fmtDateTime(s.due_at)}
                            </span>
                          )}
                        </div>
                        <p className={`mt-1 text-[13px] leading-snug ${s.completed ? "text-slate-400 line-through" : "text-slate-800"}`}>
                          {s.content || <span className="text-slate-400 italic">Sin contenido</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => onDeleteSeguimiento(s.id)}
                        className="shrink-0 text-slate-300 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </Portal>
  )
}

// ─── New Persona Modal ────────────────────────────────────────────────────────

function NewPersonaModal({
  onClose, onCreate, creating,
}: {
  onClose:  () => void
  onCreate: (data: Partial<Persona>) => Promise<void>
  creating: boolean
}) {
  const [name,         setName]         = useState("")
  const [email,        setEmail]        = useState("")
  const [phone,        setPhone]        = useState("")
  const [instagram,    setInstagram]    = useState("")
  const [scheduledAt,  setScheduledAt]  = useState("")
  const [source,       setSource]       = useState("")
  const [owner,        setOwner]        = useState("")
  const [rating,       setRating]       = useState<number>(0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await onCreate({
      name:         name.trim(),
      email:        email.trim() || null,
      phone:        phone.trim() || null,
      instagram:    instagram.trim() || null,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      source:       source.trim() || null,
      owner:        owner.trim() || null,
      rating:       rating || null,
    })
  }

  const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a]/40 focus:outline-none transition-all"

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/30" onClick={onClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-3.5 max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: "#ffffff" }}
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-slate-900">Nueva persona agendada</h3>
            <button type="button" onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Nombre *</p>
            <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre completo" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Email</p>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@..." className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Teléfono</p>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+54..." className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Instagram</p>
            <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@usuario" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Llamada agendada</p>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">De dónde llegó</p>
              <input type="text" value={source} onChange={e => setSource(e.target.value)} placeholder="Instagram, ad..." className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Owner</p>
              <input type="text" value={owner} onChange={e => setOwner(e.target.value)} placeholder="Quien hace seguimiento" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Calificación</p>
            <StarRating size="md" value={rating || null} onChange={n => setRating(n === rating ? 0 : n)} />
          </div>

          <button
            type="submit"
            disabled={!name.trim() || creating}
            className="w-full h-10 rounded-xl bg-[#E42D2C] text-white text-[13px] font-bold hover:bg-[#c42423] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Crear
          </button>
        </form>
      </div>
    </Portal>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function PersonasAgendadasView() {
  const [personas,         setPersonas]         = useState<Persona[]>([])
  const [seguimientos,     setSeguimientos]     = useState<Seguimiento[]>([])
  const [loading,          setLoading]          = useState(true)
  const [selected,         setSelected]         = useState<Persona | null>(null)
  const [deletingId,       setDeletingId]       = useState<string | null>(null)
  const [search,           setSearch]           = useState("")
  const [filterCallStatus, setFilterCallStatus] = useState<CallStatus | "todas">("todas")
  const [showNewForm,      setShowNewForm]      = useState(false)
  const [showImport,       setShowImport]       = useState(false)
  const [creating,         setCreating]         = useState(false)

  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const toast        = useToast()

  // Quick-action: open "Nueva persona" modal when ?new=1 is present, then strip the param.
  useEffect(() => {
    if (searchParams?.get("new") === "1") {
      setShowNewForm(true)
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, router, pathname])

  const getSession = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const [pRes, sRes] = await Promise.all([
        fetch("/api/admin/personas", { headers }),
        fetch("/api/admin/seguimientos", { headers }),
      ])
      if (pRes.ok) {
        const json = await pRes.json()
        setPersonas(json.personas ?? [])
      }
      if (sRes.ok) {
        const json = await sRes.json()
        setSeguimientos(json.seguimientos ?? [])
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleCreate = async (data: Partial<Persona>) => {
    setCreating(true)
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch("/api/admin/personas", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify(data),
      })
      const json = await res.json()
      if (res.ok && json.persona) {
        setPersonas(prev => [json.persona, ...prev])
        setShowNewForm(false)
        toast.success("Persona creada")
      } else {
        toast.error(json?.error ?? "No se pudo crear la persona")
      }
    } finally { setCreating(false) }
  }

  const patchPersona = async (id: string, updates: Partial<Persona>) => {
    setPersonas(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...updates } : prev)
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/personas", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id, ...updates }),
    })
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const session = await getSession()
    if (!session) return
    const res = await fetch("/api/admin/personas", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id }),
    })
    if (res.ok) {
      setPersonas(prev => prev.filter(p => p.id !== id))
      setSeguimientos(prev => prev.filter(s => s.persona_id !== id))
      if (selected?.id === id) setSelected(null)
      toast.success("Persona eliminada")
    } else {
      toast.error("No se pudo eliminar")
    }
    setDeletingId(null)
  }

  const addSeguimiento = async (data: Partial<Seguimiento>) => {
    const session = await getSession()
    if (!session) return
    const res = await fetch("/api/admin/seguimientos", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify(data),
    })
    const json = await res.json()
    if (res.ok && json.seguimiento) {
      setSeguimientos(prev => [json.seguimiento, ...prev])
    }
  }

  const patchSeguimiento = async (id: string, updates: Partial<Seguimiento>) => {
    setSeguimientos(prev => prev.map(s => s.id === id ? { ...s, ...updates, ...(("completed" in updates) ? { completed_at: updates.completed ? new Date().toISOString() : null } : {}) } : s))
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/seguimientos", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id, ...updates }),
    })
  }

  const deleteSeguimiento = async (id: string) => {
    setSeguimientos(prev => prev.filter(s => s.id !== id))
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/seguimientos", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id }),
    })
  }

  const exportCsv = () => {
    const header = ["Nombre","Email","Teléfono","Instagram","Llamada","Estado llamada","Estado venta","Owner","Source","Rating","Notas","Creada"].join(",")
    const rows = filtered.map(p =>
      [p.name, p.email, p.phone, p.instagram, p.scheduled_at, p.call_status, p.sales_status, p.owner, p.source, p.rating, p.notes, p.created_at]
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    const csv  = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement("a"), { href: url, download: "personas-agendadas.csv" }).click()
    URL.revokeObjectURL(url)
  }

  const filtered = personas.filter(p => {
    if (filterCallStatus !== "todas" && p.call_status !== filterCallStatus) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [p.name, p.email, p.instagram, p.phone, p.source, p.owner, p.notes]
      .some(v => v?.toLowerCase().includes(q))
  })

  const selectedSeguimientos = selected
    ? seguimientos.filter(s => s.persona_id === selected.id)
    : []

  return (
    <>
      {showNewForm && (
        <NewPersonaModal
          onClose={() => setShowNewForm(false)}
          onCreate={handleCreate}
          creating={creating}
        />
      )}

      {showImport && (
        <CsvImportModal
          title="Importar personas desde CSV"
          description="Cada fila se convierte en una persona agendada con sus campos."
          templateCSV={`name,email,phone,scheduled_at,sales_status,call_status,owner,source,notes,instagram
"Juan Pérez",juan@example.com,+5491155551234,2026-05-15T15:00:00Z,pendiente,no_realizada,santo@govbidder.com,SAM.gov,"Cliente potencial gov contracting",@juanperez
"María López",maria@example.com,,,propuesta,realizada,marcelo@govbidder.com,referral,,
`}
          columns={[
            { field: "name",         label: "Nombre",       required: true,  aliases: ["nombre","full_name"] },
            { field: "email",        label: "Email",        aliases: ["e-mail","correo"] },
            { field: "phone",        label: "Teléfono",     aliases: ["telefono","tel","whatsapp"] },
            { field: "scheduled_at", label: "Reunión",      aliases: ["scheduled","fecha","reunion","reunión"] },
            { field: "sales_status", label: "Estado venta", aliases: ["sales","venta","status_venta"] },
            { field: "call_status",  label: "Estado llamada", aliases: ["call","llamada","status_llamada"] },
            { field: "owner",        label: "Owner",        aliases: ["asignado","responsable"] },
            { field: "source",       label: "Source",       aliases: ["origen","fuente"] },
            { field: "notes",        label: "Notas",        aliases: ["notas","observaciones"] },
            { field: "instagram",    label: "Instagram",    aliases: ["ig"] },
          ]}
          onClose={() => setShowImport(false)}
          onImport={async (rowsToInsert) => {
            const session = await (async () => {
              const { data: { session } } = await createClient().auth.getSession()
              return session
            })()
            if (!session) return { inserted: 0, failed: rowsToInsert.length, errors: ["Sesión expirada"] }
            let inserted = 0
            const errors: string[] = []
            for (const row of rowsToInsert) {
              try {
                const res = await fetch("/api/admin/personas", {
                  method:  "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                  body:    JSON.stringify(row),
                })
                if (res.ok) inserted++
                else {
                  const j = await res.json().catch(() => ({}))
                  errors.push(`"${row.name ?? "—"}": ${j.error ?? "error"}`)
                }
              } catch (e: any) {
                errors.push(`"${row.name ?? "—"}": ${e?.message ?? "error"}`)
              }
            }
            await fetchAll()
            return { inserted, failed: rowsToInsert.length - inserted, errors }
          }}
        />
      )}

      {selected && (
        <DetailDrawer
          persona={selected}
          seguimientos={selectedSeguimientos}
          onClose={() => setSelected(null)}
          onPatch={patchPersona}
          onDelete={handleDelete}
          deleting={deletingId === selected.id}
          onAddSeguimiento={addSeguimiento}
          onPatchSeguimiento={patchSeguimiento}
          onDeleteSeguimiento={deleteSeguimiento}
        />
      )}

      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a8a] tracking-tight">Personas Agendadas</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {personas.length} {personas.length === 1 ? "persona" : "personas"} en pipeline
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchAll} disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all disabled:opacity-40">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => setShowImport(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 hover:text-[#1e3a8a] hover:border-[#1e3a8a]/30 transition-all"
              title="Importar CSV">
              <Upload className="h-4 w-4" />
            </button>
            <button onClick={exportCsv} disabled={!filtered.length}
              className="flex items-center gap-2 h-9 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-all disabled:opacity-40">
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 h-9 rounded-xl bg-[#E42D2C] px-4 text-sm font-bold text-white hover:bg-[#c42423] transition-all">
              <Plus className="h-3.5 w-3.5" />
              Nueva
            </button>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, instagram, owner..."
            className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-300 focus:border-[#1e3a8a]/40 focus:outline-none flex-1 min-w-[220px] max-w-sm"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterCallStatus("todas")}
              className={`h-8 rounded-xl border px-3 text-[12px] font-medium transition-all ${
                filterCallStatus === "todas"
                  ? "border-[#E42D2C]/40 bg-[#E42D2C]/10 text-[#E42D2C]"
                  : "border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-300"
              }`}>
              Todas
            </button>
            {CALL_STATUS_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setFilterCallStatus(filterCallStatus === s ? "todas" : s)}
                className={`h-8 rounded-xl border px-3 text-[12px] font-medium transition-all capitalize ${
                  filterCallStatus === s
                    ? CALL_STATUS_STYLE[s].replace(/border-/g, "border-").replace(/\/25/g, "/40")
                    : "border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-300"
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200 mb-4">
                <Users2 className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-[15px] font-semibold text-slate-700">
                {personas.length ? "Sin coincidencias" : "Todavía no hay personas"}
              </p>
              <p className="text-[13px] text-slate-400 mt-1 max-w-sm">
                {personas.length
                  ? "Probá ajustar los filtros o limpiar la búsqueda."
                  : "Las personas agendadas son tus prospectos: leads que viste en demos, llamadas, etc. Empezá creando la primera."}
              </p>
              {!personas.length && (
                <button
                  onClick={() => setShowNewForm(true)}
                  className="mt-4 inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva persona agendada
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {["Nombre","Llamada","Llamada","Venta","Owner","Source","Rating","Contacto",""].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}
                      onClick={() => setSelected(p)}
                      className="border-b border-slate-100 cursor-pointer transition-colors group hover:bg-slate-50">

                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-[14px] font-semibold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{p.email ?? "—"}</div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-[12px] text-slate-600">
                        {fmtDateTime(p.scheduled_at)}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${CALL_STATUS_STYLE[p.call_status]}`}>
                          {p.call_status}
                        </span>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${SALES_STATUS_STYLE[p.sales_status]}`}>
                          {p.sales_status}
                        </span>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-[13px] text-slate-600">
                        {p.owner ?? <span className="text-slate-400">—</span>}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-[13px] text-slate-600">
                        {p.source ?? <span className="text-slate-400">—</span>}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <StarRating value={p.rating}
                          onChange={n => patchPersona(p.id, { rating: n || null })} />
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {p.phone && (
                            <a href={`tel:${p.phone}`} className="text-slate-400 hover:text-slate-900 transition-colors" title={p.phone}>
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {p.instagram && (
                            <a href={`https://instagram.com/${p.instagram.replace("@","")}`} target="_blank" rel="noreferrer"
                              className="text-pink-700/70 hover:text-pink-700 transition-colors" title={p.instagram}>
                              <Instagram className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
