import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdminOrAbove, type Role } from "@/lib/types/role"
import { z } from "zod"

// =============================================================================
// POST /api/admin/reports/bulk
//
// Bulk upsert de monthly_reports a partir de filas con `month` (1-12) +
// `year` (2020-2030) separados (UX-friendly para CSV). El server combina
// ambos en formato `YYYY-MM-01` que es lo que espera la tabla.
//
// Upsert con onConflict: "month" — el constraint UNIQUE actual es sobre
// la columna `month` (date) singular (single-tenant, una fila por mes).
// =============================================================================

const ReportRow = z.object({
  month:                z.number().int().min(1).max(12),
  year:                 z.number().int().min(2020).max(2030),
  scheduled_calls:      z.number().nonnegative().optional(),
  attended_calls:       z.number().nonnegative().optional(),
  aplications:          z.number().nonnegative().optional(),
  new_clients:          z.number().nonnegative().optional(),
  offer_docs_sent:      z.number().nonnegative().optional(),
  offer_docs_responded: z.number().nonnegative().optional(),
  cierres_por_offerdoc: z.number().nonnegative().optional(),
  cash_collected:       z.number().nonnegative().optional(),
  total_revenue:        z.number().nonnegative().optional(),
  mrr:                  z.number().nonnegative().optional(),
})

const Body = z.object({
  reports: z.array(z.unknown()),
})

export async function POST(req: NextRequest) {
  // Auth
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { data: { user } } = await createClient().auth.getUser(token)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  // Admin gate
  const db = createServiceClient()
  const { data: profile } = await db
    .from("profiles").select("role").eq("id", user.id).single()
  if (!isAdminOrAbove(profile?.role as Role | undefined)) {
    return NextResponse.json({ error: "Solo admins pueden importar reportes" }, { status: 403 })
  }

  // Parse body
  let raw: unknown
  try { raw = await req.json() }
  catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }

  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido — esperaba { reports: [...] }" }, { status: 400 })
  }

  // Validate each row
  const errors: { index: number; error: string }[] = []
  const valid: Record<string, unknown>[] = []

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
    valid.push({ month: monthDate, ...metrics })
  })

  if (valid.length === 0) {
    return NextResponse.json({ inserted: 0, updated: 0, errors })
  }

  // Count existing months to distinguish inserted vs updated.
  const months = valid.map(r => r.month as string)
  const { data: existing } = await db
    .from("monthly_reports")
    .select("month")
    .in("month", months)
  const existingSet = new Set(
    (existing ?? []).map((r: { month: string }) => String(r.month).slice(0, 10))
  )

  const { error } = await db
    .from("monthly_reports")
    .upsert(valid, { onConflict: "month" })

  if (error) {
    return NextResponse.json(
      { error: error.message, inserted: 0, updated: 0, errors },
      { status: 500 }
    )
  }

  const updated = valid.filter(r => existingSet.has(String(r.month))).length
  const inserted = valid.length - updated

  return NextResponse.json({ inserted, updated, errors })
}
