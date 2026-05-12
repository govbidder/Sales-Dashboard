/**
 * Cleanup de la data demo creada por seed-demo-data.ts.
 *
 * Borra solo lo identificable como demo:
 *   - monthly_reports: meses en el rango DEMO_MONTHS_START..DEMO_MONTHS_END (12 meses).
 *   - tasks: title LIKE 'Demo - %'
 *   - personas_agendadas: name LIKE 'Demo - %'
 *   - seguimientos: cascade desde personas O content LIKE 'Demo - %'
 *   - profiles: email LIKE 'demo-%@govbidder-demo.com' (vía auth.users)
 *
 * Pide confirmación ("yes") antes de borrar.
 *
 * IMPORTANT: NO correr en producción con data real existente en esos meses.
 *
 * Run: pnpm cleanup:demo
 */

import {
  getServiceClient,
  DEMO_MONTHS_START,
  DEMO_TITLE_PREFIX,
  DEMO_PERSONA_PREFIX,
  DEMO_SEGUIMIENTO_PREFIX,
  DEMO_PROFILE_EMAIL_GLOB,
} from "./_lib"
import { createInterface } from "node:readline"

const db = getServiceClient()

// ─── Confirmation ────────────────────────────────────────────────────────────

function confirm(question: string): Promise<boolean> {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim().toLowerCase() === "yes")
    })
  })
}

// ─── Delete operations ───────────────────────────────────────────────────────

async function deleteMonthlyReports() {
  // Rango: 12 meses desde DEMO_MONTHS_START.
  const start = new Date(DEMO_MONTHS_START)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 11)
  const endISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-01`

  const { error, count } = await db
    .from("monthly_reports")
    .delete({ count: "exact" })
    .gte("month", DEMO_MONTHS_START)
    .lte("month", endISO)

  if (error) { console.error("  ✗ monthly_reports:", error.message); return 0 }
  return count ?? 0
}

async function deleteTasks() {
  const { error, count } = await db
    .from("tasks")
    .delete({ count: "exact" })
    .like("title", `${DEMO_TITLE_PREFIX}%`)
  if (error) { console.error("  ✗ tasks:", error.message); return 0 }
  return count ?? 0
}

async function deleteSeguimientos() {
  const { error, count } = await db
    .from("seguimientos")
    .delete({ count: "exact" })
    .like("content", `${DEMO_SEGUIMIENTO_PREFIX}%`)
  if (error) { console.error("  ✗ seguimientos:", error.message); return 0 }
  return count ?? 0
}

async function deletePersonas() {
  // Tiene que ir DESPUÉS de seguimientos para evitar cascade orphan messages,
  // pero personas_agendadas tiene "on delete cascade" en seguimientos, así
  // que también arrastra cualquier seguimiento residual.
  const { error, count } = await db
    .from("personas_agendadas")
    .delete({ count: "exact" })
    .like("name", `${DEMO_PERSONA_PREFIX}%`)
  if (error) { console.error("  ✗ personas:", error.message); return 0 }
  return count ?? 0
}

async function deleteProfilesAndAuth() {
  // Buscamos auth users con email demo y los borramos. El delete cascadeará a profiles.
  // SKIPPED si auth.admin.listUsers no devuelve ninguno (porque seed no crea profiles).
  const { data } = await db.auth.admin.listUsers({ perPage: 200 })
  const targets = (data?.users ?? []).filter(u =>
    u.email?.startsWith("demo-") && u.email?.endsWith("@govbidder-demo.com")
  )

  if (targets.length === 0) {
    return 0
  }

  let deleted = 0
  for (const u of targets) {
    const { error } = await db.auth.admin.deleteUser(u.id)
    if (!error) deleted++
    else console.error(`  ✗ borrando ${u.email}:`, error.message)
  }
  return deleted
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗")
  console.log("║  Cleanup de data demo — GovBidder Dashboard                ║")
  console.log("╚════════════════════════════════════════════════════════════╝")
  console.log("\nEste script BORRARÁ:")
  console.log(`  • monthly_reports con month en ${DEMO_MONTHS_START}..(+11 meses)`)
  console.log(`  • tasks con title LIKE '${DEMO_TITLE_PREFIX}%'`)
  console.log(`  • personas_agendadas con name LIKE '${DEMO_PERSONA_PREFIX}%'`)
  console.log(`  • seguimientos con content LIKE '${DEMO_SEGUIMIENTO_PREFIX}%'`)
  console.log(`  • auth users con email LIKE '${DEMO_PROFILE_EMAIL_GLOB}' (cascade a profiles)`)
  console.log("\n⚠ Si corriste el seed sobre una DB que ya tenía reportes reales")
  console.log("  en esos meses, también se borrarán. Verificá antes de continuar.")

  const ok = await confirm("\nEscribí 'yes' (literal) para continuar: ")
  if (!ok) {
    console.log("Cancelado.")
    return
  }

  console.log("\nBorrando...\n")

  // Orden: seguimientos antes que personas (por las dudas, aunque cascade), luego el resto.
  const seguimientos = await deleteSeguimientos()
  const personas     = await deletePersonas()
  const tasks        = await deleteTasks()
  const reports      = await deleteMonthlyReports()
  const profiles     = await deleteProfilesAndAuth()

  console.log("────────────────────────────────────────────────────────────")
  console.log("Borradas:")
  console.log(`  seguimientos:       ${seguimientos}`)
  console.log(`  personas_agendadas: ${personas}`)
  console.log(`  tasks:              ${tasks}`)
  console.log(`  monthly_reports:    ${reports}`)
  console.log(`  profiles + auth:    ${profiles}`)
  console.log("\n✓ Cleanup completado.")
}

main().catch(e => {
  console.error("\n✗ Error fatal:", e)
  process.exit(1)
})
