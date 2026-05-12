import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdminOrAbove } from "@/lib/types/role"
import { getEffectiveUser } from "@/lib/auth/get-effective-user"
import { z } from "zod"

// =============================================================================
// POST /api/admin/reports/bulk
//
// Bulk upsert de monthly_reports a partir de filas con `month` (1-12) +
// `year` (2020-2030) separados (UX-friendly para CSV).
//
// Body: { reports: [...], department_id?: string | null }
// - department_id ausente o null → todas las filas son GLOBAL.
// - department_id presente → todas las filas son de ese depto.
//
// Como los índices únicos son parciales (separados para global vs dept),
// el upsert nativo de Supabase no funciona — hacemos check + insert/update
// por fila.
// =============================================================================

const ReportRow = z.object({
  month:                z.number().int().min(1).max(12),
  year:                 z.number().int().min(2020).max(2030),
  scheduled_calls:      z.number().nonnegative().optional(),
  attended_calls:       z.number().nonnegative().optional(),
  applications:         z.number().nonnegative().optional(),
  new_clients:          z.number().nonnegative().optional(),
  offer_docs_sent:      z.number().nonnegative().optional(),
  offer_docs_responded: z.number().nonnegative().optional(),
  cierres_por_offerdoc: z.number().nonnegative().optional(),
  cash_collected:       z.number().nonnegative().optional(),
  total_revenue:        z.number().nonnegative().optional(),
  mrr:                  z.number().nonnegative().optional(),
})

const Body = z.object({
  reports:       z.array(z.unknown()),
  department_id: z.string().nullable().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await getEffectiveUser(req)
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (!isAdminOrAbove(auth.effectiveUser.role)) {
    return NextResponse.json({ error: "Solo admins pueden importar reportes" }, { status: 403 })
  }

  const db = createServiceClient()

  let raw: unknown
  try { raw = await req.json() }
  catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }

  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido — esperaba { reports: [...] }" }, { status: 400 })
  }

  const targetDept: string | null = parsed.data.department_id ?? null

  const errors: { index: number; error: string }[] = []
  const valid: Array<{ month: string; metrics: Record<string, unknown> }> = []

  parsed.data.reports.forEach((row, i) => {
    const res = ReportRow.safeParse(row)
    if (!res.success) {
      errors.push({
        index: i,
        error: res.error.issues
          .map(iss => `${iss.path.join(".") || "(root)"}: ${iss.message}`)
          .join("; "),
      })
      return
    }
    const r = res.data
    const monthDate = `${r.year}-${String(r.month).padStart(2, "0")}-01`
    const { month: _m, year: _y, ...metrics } = r
    valid.push({ month: monthDate, metrics: metrics as Record<string, unknown> })
  })

  if (valid.length === 0) {
    return NextResponse.json({ inserted: 0, updated: 0, errors })
  }

  // Per-row upsert manual: el schema tiene índices únicos parciales separados
  // (global vs dept) que la API nativa de upsert no maneja.
  let inserted = 0
  let updated  = 0

  for (let i = 0; i < valid.length; i++) {
    const v = valid[i]
    try {
      const existingQ = db.from("monthly_reports").select("id").eq("month", v.month)
      const { data: existing } = targetDept
        ? await existingQ.eq("department_id", targetDept).maybeSingle()
        : await existingQ.is("department_id", null).maybeSingle()

      if (existing) {
        const { error } = await db.from("monthly_reports").update(v.metrics).eq("id", existing.id)
        if (error) throw new Error(error.message)
        updated++
      } else {
        const { error } = await db.from("monthly_reports").insert({
          month: v.month, department_id: targetDept, ...v.metrics,
        })
        if (error) throw new Error(error.message)
        inserted++
      }
    } catch (e: any) {
      errors.push({ index: i, error: e?.message ?? "Error al guardar" })
    }
  }

  return NextResponse.json({ inserted, updated, errors })
}
