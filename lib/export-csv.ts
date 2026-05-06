/**
 * Export an array of objects as a CSV file (client-side).
 *
 * - Auto-detects columns from the first row's keys, OR uses the explicit
 *   `columns` list (preserves order).
 * - Escapes commas, quotes and newlines per RFC 4180.
 * - Triggers a browser download with the given filename.
 */
export function exportToCSV<T extends Record<string, any>>(
  rows: T[],
  filename: string,
  options: {
    columns?: { key: keyof T; header: string }[]
  } = {},
) {
  if (typeof window === "undefined") return
  if (!rows.length) {
    alert("No hay datos para exportar.")
    return
  }

  const cols = options.columns ?? Object.keys(rows[0]).map(k => ({ key: k as keyof T, header: k }))

  const escape = (value: any): string => {
    if (value === null || value === undefined) return ""
    let str = typeof value === "object" ? JSON.stringify(value) : String(value)
    // RFC 4180 escape: wrap in quotes if contains comma/quote/newline; double inner quotes
    if (/[",\n\r]/.test(str)) {
      str = `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headerLine = cols.map(c => escape(c.header)).join(",")
  const bodyLines = rows.map(r => cols.map(c => escape(r[c.key])).join(","))
  const csv = "﻿" + [headerLine, ...bodyLines].join("\n")  // BOM for Excel UTF-8

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Format a date for CSV (ISO short form). */
export function csvDate(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 19).replace("T", " ")
}
