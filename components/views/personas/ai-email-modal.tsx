"use client"

import { useState } from "react"
import { Portal } from "@/components/ui/portal"
import { createClient } from "@/lib/supabase"
import {
  Sparkles, X, Loader2, Copy, Check, Mail, AlertCircle, Send,
} from "lucide-react"

interface Props {
  personaId:   string
  personaName: string
  personaEmail?: string | null
  onClose:     () => void
}

const INTENTS: { value: string; label: string }[] = [
  { value: "follow_up",     label: "Follow-up (retomar contacto)" },
  { value: "first_contact", label: "Primer contacto" },
  { value: "nurture",       label: "Nurture (mantener relación)" },
  { value: "check_in",      label: "Check-in (¿necesita algo?)" },
  { value: "thank_you",     label: "Agradecer" },
  { value: "custom",        label: "Custom (libre, usá las notas)" },
]

const TONES: { value: "formal" | "casual" | "directo"; label: string }[] = [
  { value: "casual",  label: "Casual" },
  { value: "formal",  label: "Formal" },
  { value: "directo", label: "Directo" },
]

export function AiEmailModal({ personaId, personaName, personaEmail, onClose }: Props) {
  const [phase,   setPhase]   = useState<"input" | "preview">("input")
  const [intent,  setIntent]  = useState("follow_up")
  const [tone,    setTone]    = useState<"formal" | "casual" | "directo">("casual")
  const [language, setLanguage] = useState<"es" | "en">("es")
  const [notes,   setNotes]   = useState("")
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState<string | null>(null)
  const [subject, setSubject] = useState("")
  const [bodyText, setBodyText] = useState("")
  const [copied,  setCopied]  = useState<"subject" | "body" | null>(null)

  const compose = async () => {
    setLoading(true)
    setErr(null)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) { setErr("Sesión expirada."); return }
      const res = await fetch("/api/admin/ai-email", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ personaId, intent, tone, language, notes: notes || undefined }),
      })
      const j = await res.json()
      if (!res.ok) { setErr(j.error || "No pude generar el email."); return }
      setSubject(j.subject ?? "")
      setBodyText(j.body ?? "")
      setPhase("preview")
    } finally { setLoading(false) }
  }

  const copy = async (kind: "subject" | "body") => {
    try {
      await navigator.clipboard.writeText(kind === "subject" ? subject : bodyText)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    } catch { /* ignore */ }
  }

  const openInGmail = () => {
    const to = personaEmail ?? ""
    const url = `https://mail.google.com/mail/?view=cm&fs=1` +
      `&to=${encodeURIComponent(to)}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(bodyText)}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const openInMailto = () => {
    const to = personaEmail ?? ""
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`
    window.location.href = url
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#E42D2C]/10 to-[#1e3a8a]/10 ring-1 ring-[#1e3a8a]/15">
                <Mail className="h-4 w-4 text-[#1e3a8a]" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">Email para {personaName}</h3>
                <p className="text-[11px] text-slate-500">
                  {phase === "input"
                    ? "Configurá el intent y la IA redacta personalizado."
                    : personaEmail ?? "(sin email registrado)"}
                </p>
              </div>
            </div>
            <button onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">

            {phase === "input" && (
              <>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Intent</p>
                  <select
                    value={intent}
                    onChange={e => setIntent(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none cursor-pointer hover:border-slate-300 focus:border-[#1e3a8a]/40"
                  >
                    {INTENTS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Tono</p>
                    <div className="inline-flex h-10 w-full rounded-xl border border-slate-200 bg-white p-0.5">
                      {TONES.map(t => (
                        <button
                          key={t.value}
                          onClick={() => setTone(t.value)}
                          className={`flex flex-1 items-center justify-center rounded-lg text-[12px] font-medium transition-all ${
                            tone === t.value ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Idioma</p>
                    <div className="inline-flex h-10 w-full rounded-xl border border-slate-200 bg-white p-0.5">
                      <button
                        onClick={() => setLanguage("es")}
                        className={`flex flex-1 items-center justify-center rounded-lg text-[12px] font-medium transition-all ${
                          language === "es" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
                        }`}
                      >Español</button>
                      <button
                        onClick={() => setLanguage("en")}
                        className={`flex flex-1 items-center justify-center rounded-lg text-[12px] font-medium transition-all ${
                          language === "en" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
                        }`}
                      >English</button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Notas adicionales (opcional)</p>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Ej: avisarle que la propuesta del bid 2024-007 está lista y mandar en archivo adjunto."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#1e3a8a]/40 focus:ring-2 focus:ring-[#1e3a8a]/10 resize-none"
                  />
                </div>

                {err && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{err}</span>
                  </div>
                )}
              </>
            )}

            {phase === "preview" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Subject</p>
                    <button
                      onClick={() => copy("subject")}
                      className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500 hover:text-[#1e3a8a]"
                    >
                      {copied === "subject"
                        ? <><Check className="h-2.5 w-2.5" /> Copiado</>
                        : <><Copy className="h-2.5 w-2.5" /> Copiar</>}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-900 outline-none focus:border-[#1e3a8a]/40 focus:ring-2 focus:ring-[#1e3a8a]/10"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Body</p>
                    <button
                      onClick={() => copy("body")}
                      className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500 hover:text-[#1e3a8a]"
                    >
                      {copied === "body"
                        ? <><Check className="h-2.5 w-2.5" /> Copiado</>
                        : <><Copy className="h-2.5 w-2.5" /> Copiar</>}
                    </button>
                  </div>
                  <textarea
                    value={bodyText}
                    onChange={e => setBodyText(e.target.value)}
                    rows={14}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-700 leading-relaxed outline-none focus:border-[#1e3a8a]/40 focus:ring-2 focus:ring-[#1e3a8a]/10 resize-none font-mono"
                  />
                </div>

                {err && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{err}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-6 py-3 flex items-center justify-between gap-3">
            {phase === "input" ? (
              <>
                <button onClick={onClose} className="text-[12px] text-slate-500 hover:text-slate-900 px-2 py-1.5">
                  Cancelar
                </button>
                <button
                  onClick={compose}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] hover:shadow-[0_4px_14px_rgba(228,45,44,0.25)] transition-all disabled:opacity-40"
                >
                  {loading
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Redactando…</>
                    : <><Sparkles className="h-3.5 w-3.5" /> Redactar con IA</>}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setPhase("input")}
                  className="text-[12px] text-slate-500 hover:text-slate-900 px-2 py-1.5"
                >
                  ← Regenerar
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openInMailto}
                    className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:border-[#1e3a8a]/30 hover:text-[#1e3a8a] transition-colors"
                  >
                    Abrir en cliente local
                  </button>
                  <button
                    onClick={openInGmail}
                    disabled={!personaEmail}
                    className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] hover:shadow-[0_4px_14px_rgba(228,45,44,0.25)] transition-all disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Abrir en Gmail
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Portal>
  )
}
