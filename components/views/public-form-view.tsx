"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Loader2, AlertCircle, CheckCircle2, Send } from "lucide-react"

interface FormField {
  key:         string
  label:       string
  type:        "text" | "longtext" | "email" | "phone" | "select" | "date"
  required?:   boolean
  placeholder?: string
  options?:    string[]
}

interface FormConfig {
  id:          string
  slug:        string
  title:       string
  description: string | null
  fields:      FormField[]
}

export function PublicFormView({ slug }: { slug: string }) {
  const [form,    setForm]    = useState<FormConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState<string | null>(null)
  const [values,  setValues]  = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch(`/api/forms/${slug}`)
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (ok && j.form) setForm(j.form)
        else setErr(j.error || "Form no encontrado.")
      })
      .catch(e => setErr(e?.message ?? "Error"))
      .finally(() => setLoading(false))
  }, [slug])

  const handleChange = (key: string, value: string) => {
    setValues(v => ({ ...v, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    setSubmitting(true)
    setErr(null)
    try {
      const res = await fetch(`/api/forms/${slug}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(values),
      })
      const j = await res.json()
      if (res.ok) setSubmitted(true)
      else setErr(j.error || "No pude mandar el form.")
    } catch (e: any) {
      setErr(e?.message ?? "Error inesperado.")
    } finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12 relative overflow-hidden">

      {/* Subtle ambient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-[#E42D2C]/[0.05] blur-[160px]" />
        <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-[#1e3a8a]/[0.04] blur-[140px]" />
      </div>

      <div className="relative w-full max-w-[480px]">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/icon.png"
            alt="GovBidder"
            width={200}
            height={150}
            className="h-auto w-[160px] object-contain"
            priority
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
          </div>
        ) : !form ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertCircle className="mx-auto h-6 w-6 text-red-500 mb-2" />
            <p className="text-[13px] font-semibold text-red-700">{err ?? "Form no disponible"}</p>
          </div>
        ) : submitted ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h2 className="text-[18px] font-bold text-emerald-900">¡Recibido!</h2>
            <p className="text-[13px] text-emerald-700 mt-1.5">
              Tu mensaje llegó al equipo. Nos ponemos en contacto en menos de 24 horas.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="mb-6 text-center">
              <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{form.title}</h1>
              {form.description && (
                <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">{form.description}</p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {form.fields.map(f => (
                <div key={f.key} className="space-y-1.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    {f.label} {f.required && <span className="text-[#E42D2C]">*</span>}
                  </label>
                  {f.type === "longtext" ? (
                    <textarea
                      value={values[f.key] ?? ""}
                      onChange={e => handleChange(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      required={f.required}
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-all focus:border-[#E42D2C] focus:ring-2 focus:ring-[#E42D2C]/15 resize-none"
                    />
                  ) : f.type === "select" ? (
                    <select
                      value={values[f.key] ?? ""}
                      onChange={e => handleChange(f.key, e.target.value)}
                      required={f.required}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#E42D2C] focus:ring-2 focus:ring-[#E42D2C]/15"
                    >
                      <option value="">— Elegir —</option>
                      {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : f.type === "date" ? "date" : "text"}
                      value={values[f.key] ?? ""}
                      onChange={e => handleChange(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      required={f.required}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-all focus:border-[#E42D2C] focus:ring-2 focus:ring-[#E42D2C]/15"
                    />
                  )}
                </div>
              ))}

              {err && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{err}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 h-12 w-full rounded-full bg-[#E42D2C] text-sm font-bold text-white transition-all hover:bg-[#c42423] hover:shadow-[0_8px_24px_rgba(228,45,44,0.30)] disabled:opacity-50 active:scale-[0.98] inline-flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
                  : <><Send className="h-4 w-4" /> Enviar</>}
              </button>
            </form>
          </div>
        )}

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.22em] text-slate-300">
          Powered by GovBidder
        </p>
      </div>
    </div>
  )
}
