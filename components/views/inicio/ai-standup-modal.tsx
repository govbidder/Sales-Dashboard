"use client"

import { useState, useEffect } from "react"
import { Portal } from "@/components/ui/portal"
import { createClient } from "@/lib/supabase"
import {
  Sparkles, X, Loader2, Copy, Check, AlertCircle, RefreshCw,
} from "lucide-react"

interface Props {
  onClose: () => void
}

export function AiStandupModal({ onClose }: Props) {
  const [loading,  setLoading]  = useState(true)
  const [markdown, setMarkdown] = useState<string>("")
  const [meta,     setMeta]     = useState<any>(null)
  const [err,      setErr]      = useState<string | null>(null)
  const [copied,   setCopied]   = useState(false)

  const generate = async () => {
    setLoading(true)
    setErr(null)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) { setErr("Sesión expirada."); return }
      const res = await fetch("/api/admin/ai-standup", {
        method:  "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const j = await res.json()
      if (res.ok) {
        setMarkdown(j.markdown ?? "")
        setMeta(j.meta ?? null)
      } else {
        setErr(j.error || "No pude generar el standup.")
      }
    } catch (e: any) {
      setErr(e?.message ?? "Error inesperado.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { generate() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
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
                <Sparkles className="h-4 w-4 text-[#1e3a8a]" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">Standup diario</h3>
                <p className="text-[11px] text-slate-500">
                  {loading
                    ? "Generando con IA…"
                    : meta
                      ? `${meta.updated_count} cambios · ${meta.overdue_count} vencidas · ${meta.upcoming_count} próximas · ${meta.comments_count} comentarios`
                      : "Resumen de las últimas 24h"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={generate}
                disabled={loading}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-[#1e3a8a] hover:bg-slate-100 transition-all disabled:opacity-40"
                title="Regenerar"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-[#1e3a8a]/60" />
                <p className="text-[12px] text-slate-500">Analizando últimas 24h…</p>
              </div>
            ) : err ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-800">
                  {markdown}
                </pre>
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && !err && markdown && (
            <div className="border-t border-slate-200 px-6 py-3 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                Listo para pegar en Slack o WhatsApp.
              </span>
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] hover:shadow-[0_4px_14px_rgba(228,45,44,0.25)] transition-all"
              >
                {copied
                  ? <><Check className="h-3.5 w-3.5" /> Copiado</>
                  : <><Copy className="h-3.5 w-3.5" /> Copiar markdown</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}
