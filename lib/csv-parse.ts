/**
 * Minimal CSV parser — handles quoted fields, escaped quotes, embedded commas
 * and newlines. RFC 4180 compliant for the common cases.
 *
 * Returns: { headers: string[], rows: Record<string, string>[] }
 */
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)

  const lines: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ }   // escaped quote
        else                      inQuotes = false
      } else {
        cell += c
      }
    } else {
      if (c === '"')              inQuotes = true
      else if (c === ",")        { row.push(cell); cell = "" }
      else if (c === "\n")       { row.push(cell); lines.push(row); row = []; cell = "" }
      else if (c === "\r")       { /* ignore */ }
      else                       cell += c
    }
  }
  // Last row
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    lines.push(row)
  }

  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = lines[0].map(h => h.trim())
  const rows = lines.slice(1)
    .filter(r => r.some(c => c.trim().length > 0))   // skip empty rows
    .map(r => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = (r[i] ?? "").trim() })
      return obj
    })

  return { headers, rows }
}
