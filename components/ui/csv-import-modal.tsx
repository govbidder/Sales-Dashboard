"use client"

import { useState, useRef } from "react"
import { Portal } from "@/components/ui/portal"
import { parseCSV } from "@/lib/csv-parse"
import {
  Upload, X, AlertCircle, Check, FileText, Download, Loader2,
} from "lucide-react"

interface ColumnMapping {
  /** Internal field key in the DB */
  field:        string
  /** Human label shown to the user */
  label:        string
  /** Whether this field is required (any unmapped row will be rejected) */
  required?:    boolean
  /** Aliases the parser tries to auto-match against CSV headers */
  aliases?:     string[]
  /** Optional transformer: transforms the cell value before insert */
  transform?:   (val: string) => any
}

interface Props {
  /** Title shown in the modal header */
  title:        string
  /** Brief description of what this importer does */
  description:  string
  /** The columns this entity supports — the user maps CSV headers to these */
  columns:      ColumnMapping[]
  /** Sample CSV string for the "Download template" button */
  templateCSV:  string
  /** Called per row to insert into the API. Returns ok/error per row. */
  onImport:     (rows: Record<string, any>[]) => Promise<{ inserted: number; failed: number; errors: string[] }>
  onClose:      () => void
}

export function CsvImportModal({ title, description, columns, templateCSV, onImport, onClose }: Props) {
  const [phase,    setPhase]    = useState<"upload" | "mapping" | "result">("upload")
  const [rawText,  setRawText]  = useState<string>("")
  const [headers,  setHeaders]  = useState<string[]>([])
  const [rows,     setRows]     = useState<Record<string, string>[]>([])
  const [mapping,  setMapping]  = useState<Record<string, string>>({}) // field → CSV header
  const [busy,     setBusy]     = useState(false)
  const [err,      setErr]      = useState<string | null>(null)
  const [result,   setResult]   = useState<{ inserted: number; failed: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const handleFile = async (file: File) => {
    setErr(null)
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setErr("Subí un archivo .csv"); return
    }
    const text = await file.text()
    setRawText(text)
    const { headers, rows } = parseCSV(text)
    if (!rows.length) { setErr("El archivo no tiene filas de datos"); return }
    setHeaders(headers)
    setRows(rows)

    // Auto-map: for each column, find a header that matches by name or alias (case-insensitive)
    const auto: Record<string, string> = {}
    for (const col of columns) {
      const candidates = [col.field, col.label, ...(col.aliases ?? [])].map(s => s.toLowerCase())
      const match = headers.find(h => candidates.includes(h.toLowerCase()))
      if (match) auto[col.field] = match
    }
    setMapping(auto)
    setPhase("mapping")
  }

  const downloadTemplate = () => {
    const blob = new Blob(["﻿" + templateCSV], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `template_${title.toLowerCase().replace(/\s+/g, "_")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importNow = async () => {
    // Validate required mappings
    for (const col of columns) {
      if (col.required && !mapping[col.field]) {
        setErr(`Falta mapear el campo requerido: ${col.label}`); return
      }
    }
    setBusy(true)
    setErr(null)
    try {
      // Transform rows according to mapping
      const transformed = rows.map(r => {
        const obj: Record<string, any> = {}
        for (const col of columns) {
          const csvKey = mapping[col.field]
          if (!csvKey) continue
          const raw = r[csvKey] ?? ""
          if (raw.trim() === "" && !col.required) continue
          obj[col.field] = col.transform ? col.transform(raw) : raw
        }
        return obj
      })
      const r = await onImport(transformed)
      setResult(r)
      setPhase("result")
    } catch (e: any) {
      setErr(e?.message ?? "Error inesperado")
    } finally { setBusy(false) }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e3a8a]/[0.06] ring-1 ring-[#1e3a8a]/15">
                <Upload className="h-4 w-4 text-[#1e3a8a]" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
                <p className="text-[11px] text-slate-500">{description}</p>
              </div>
            </div>
            <button onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">

            {/* Phase: UPLOAD */}
            {phase === "upload" && (
              <>
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1.5 h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11.5px] font-semibold text-slate-600 hover:border-[#1e3a8a]/30 hover:text-[#1e3a8a] transition-colors mb-2"
                >
                  <Download className="h-3 w-3" /> Descargar template
                </button>

                <label
                  className="flex flex-col items-center justify-center gap-2 py-12 px-6 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 cursor-pointer hover:border-[#1e3a8a]/40 hover:bg-[#1e3a8a]/[0.03] transition-colors"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    const file = e.dataTransfer.files[0]
                    if (file) handleFile(file)
                  }}
                >
                  <Upload className="h-7 w-7 text-slate-400" />
                  <p className="text-[13.5px] font-bold text-slate-700">Soltá un archivo CSV o hacé click</p>
                  <p className="text-[11px] text-slate-400">Hasta 5 MB · UTF-8 con headers en la primera fila</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                  />
                </label>

                {err && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{err}</span>
                  </div>
                )}
              </>
            )}

            {/* Phase: MAPPING */}
            {phase === "mapping" && (
              <>
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-800">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>
                    Detecté <strong>{rows.length}</strong> filas. Mapeá las columnas si hace falta:
                  </span>
                </div>

                <div className="space-y-1.5">
                  {columns.map(col => (
                    <div key={col.field} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-bold text-slate-900">
                          {col.label}
                          {col.required && <span className="ml-1 text-[#E42D2C]">*</span>}
                        </p>
                        <p className="text-[10.5px] text-slate-400 font-mono">{col.field}</p>
                      </div>
                      <span className="text-slate-300">→</span>
                      <select
                        value={mapping[col.field] ?? ""}
                        onChange={e => setMapping(m => ({ ...m, [col.field]: e.target.value }))}
                        className="h-8 w-48 rounded-lg border border-slate-200 bg-white px-2 text-[11.5px] text-slate-900 outline-none cursor-pointer focus:border-[#1e3a8a]/40"
                      >
                        <option value="">— Ignorar —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Preview first 3 rows */}
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Preview (primeras 3 filas)
                  </p>
                  <div className="space-y-1.5">
                    {rows.slice(0, 3).map((r, i) => (
                      <div key={i} className="rounded-md bg-white p-2 text-[11px] text-slate-700 border border-slate-200">
                        {columns
                          .filter(c => mapping[c.field])
                          .map(c => (
                            <div key={c.field} className="flex gap-2">
                              <span className="font-bold text-slate-500 min-w-[100px]">{c.label}:</span>
                              <span className="text-slate-700 truncate">{r[mapping[c.field]] || "—"}</span>
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                </div>

                {err && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{err}</span>
                  </div>
                )}
              </>
            )}

            {/* Phase: RESULT */}
            {phase === "result" && result && (
              <div className="space-y-3">
                <div className="flex items-center justify-center py-6">
                  {result.failed === 0 ? (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="h-6 w-6" />
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white">
                      <AlertCircle className="h-6 w-6" />
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-[18px] font-bold text-slate-900">
                    {result.inserted} importadas
                  </p>
                  {result.failed > 0 && (
                    <p className="text-[13px] text-amber-600 mt-1">{result.failed} filas fallaron</p>
                  )}
                </div>

                {result.errors.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 max-h-40 overflow-y-auto">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1.5">
                      Errores
                    </p>
                    <ul className="text-[11.5px] text-red-700 space-y-0.5 list-disc list-inside">
                      {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                      {result.errors.length > 10 && <li>… y {result.errors.length - 10} más</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-6 py-3 flex items-center justify-between gap-3">
            {phase === "upload" && (
              <>
                <span className="text-[11px] text-slate-400">CSV con headers en la primera fila</span>
                <button onClick={onClose} className="text-[12px] text-slate-500 hover:text-slate-900 px-2 py-1.5">Cancelar</button>
              </>
            )}
            {phase === "mapping" && (
              <>
                <button
                  onClick={() => { setPhase("upload"); setRows([]); setHeaders([]); setMapping({}) }}
                  className="text-[12px] text-slate-500 hover:text-slate-900 px-2 py-1.5"
                >
                  ← Cambiar archivo
                </button>
                <button
                  onClick={importNow}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#E42D2C] px-4 text-[12px] font-bold text-white hover:bg-[#c42423] hover:shadow-[0_4px_14px_rgba(228,45,44,0.25)] transition-all disabled:opacity-40"
                >
                  {busy
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importando…</>
                    : <><Upload className="h-3.5 w-3.5" /> Importar {rows.length} filas</>}
                </button>
              </>
            )}
            {phase === "result" && (
              <button
                onClick={onClose}
                className="ml-auto inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#1e3a8a] px-4 text-[12px] font-bold text-white hover:bg-[#1e40af] transition-colors"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  )
}
