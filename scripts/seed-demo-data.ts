/**
 * Seed de data demo para presentación.
 *
 * Llenar el dashboard con data ficticia identificable. Idempotente:
 * correr 2 veces no duplica nada (todo va con upsert o filtros que
 * detectan lo ya creado por el seed).
 *
 * IMPORTANT: NO correr en producción con data real existente.
 *
 * Run: pnpm seed:demo
 */

import {
  getServiceClient,
  DEMO_MONTHS_START,
  DEMO_TITLE_PREFIX,
  DEMO_PERSONA_PREFIX,
  DEMO_SEGUIMIENTO_PREFIX,
  DEMO_TEAM,
  DEMO_PASSWORD,
} from "./_lib"

const db = getServiceClient()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addMonths(date: Date, n: number) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

function isoMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`
}

function lerpInt(from: number, to: number, t: number) {
  return Math.round(from + (to - from) * t)
}

function daysFromNow(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

// ─── 1) monthly_reports ──────────────────────────────────────────────────────

async function seedMonthlyReports() {
  console.log("\n[1/4] Monthly reports (12 meses, mayo 2025 → abril 2026)")

  const start = new Date(DEMO_MONTHS_START)
  const rows: Record<string, any>[] = []
  for (let i = 0; i < 12; i++) {
    const t = i / 11 // 0..1
    const scheduled = lerpInt(30, 80, t)
    const attended  = Math.round(scheduled * 0.75)
    const sent      = lerpInt(20, 50, t)
    const responded = Math.round(sent * 0.60)
    rows.push({
      month:                isoMonth(addMonths(start, i)),
      scheduled_calls:      scheduled,
      attended_calls:       attended,
      aplications:          lerpInt(50, 150, t),
      new_clients:          lerpInt(5, 15, t),
      offer_docs_sent:      sent,
      offer_docs_responded: responded,
      cierres_por_offerdoc: Math.round(responded * 0.40),
      cash_collected:       lerpInt(8000, 25000, t),
      total_revenue:        Math.round(lerpInt(8000, 25000, t) * 1.2),
      mrr:                  lerpInt(5000, 20000, t),
    })
  }

  const { error } = await db
    .from("monthly_reports")
    .upsert(rows, { onConflict: "month" })

  if (error) {
    console.error("  ✗", error.message)
    return 0
  }
  console.log(`  ✓ ${rows.length} reportes upserted`)
  return rows.length
}

// ─── 2) tasks ────────────────────────────────────────────────────────────────

interface DemoTaskDef {
  title:      string
  department: string
  status:     "pendiente" | "en_progreso" | "completada" | "cancelada"
  priority:   "baja" | "media" | "alta" | "urgente"
  dueOffset:  number | null  // days from now; negative = overdue
}

const TASK_DEFS: DemoTaskDef[] = [
  // IA
  { title: "Demo - Setup automation flujo de leads",              department: "IA",           status: "en_progreso", priority: "alta",    dueOffset: 3   },
  { title: "Demo - Entrenar modelo de clasificación de RFPs",     department: "IA",           status: "pendiente",   priority: "media",   dueOffset: 10  },
  { title: "Demo - Conectar Anthropic API con el CRM",            department: "IA",           status: "completada",  priority: "alta",    dueOffset: -5  },
  { title: "Demo - Auditoría compliance SAM.gov",                 department: "IA",           status: "pendiente",   priority: "urgente", dueOffset: -2  },
  { title: "Demo - Documentar prompts del email composer",        department: "IA",           status: "en_progreso", priority: "baja",    dueOffset: 14  },
  // Marketing
  { title: "Demo - Diseñar campaña Q2 para LinkedIn",             department: "Marketing",    status: "en_progreso", priority: "alta",    dueOffset: 5   },
  { title: "Demo - Coordinar webinar de lanzamiento",             department: "Marketing",    status: "pendiente",   priority: "alta",    dueOffset: 7   },
  { title: "Demo - Revisar copy del landing principal",           department: "Marketing",    status: "completada",  priority: "media",   dueOffset: -8  },
  { title: "Demo - Reporte de NPS Q1",                            department: "Marketing",    status: "pendiente",   priority: "media",   dueOffset: -1  },
  { title: "Demo - Newsletter de mayo",                           department: "Marketing",    status: "pendiente",   priority: "baja",    dueOffset: 20  },
  // Anuncios
  { title: "Demo - Analizar performance ads YouTube",             department: "Anuncios",     status: "en_progreso", priority: "alta",    dueOffset: 2   },
  { title: "Demo - Setup retargeting Meta Ads",                   department: "Anuncios",     status: "pendiente",   priority: "media",   dueOffset: 8   },
  { title: "Demo - Pausar campañas con CPL > $80",                department: "Anuncios",     status: "completada",  priority: "urgente", dueOffset: -3  },
  { title: "Demo - A/B test creatividades de licitaciones",       department: "Anuncios",     status: "en_progreso", priority: "media",   dueOffset: 12  },
  { title: "Demo - Reporte semanal de ROAS",                      department: "Anuncios",     status: "pendiente",   priority: "baja",    dueOffset: -4  },
  // Orgánico
  { title: "Demo - Publicar 3 reels esta semana",                 department: "Orgánico",     status: "en_progreso", priority: "media",   dueOffset: 4   },
  { title: "Demo - Investigar palabras clave GSA",                department: "Orgánico",     status: "pendiente",   priority: "media",   dueOffset: 9   },
  { title: "Demo - Calendario editorial de mayo",                 department: "Orgánico",     status: "completada",  priority: "alta",    dueOffset: -10 },
  { title: "Demo - SEO audit del blog",                           department: "Orgánico",     status: "pendiente",   priority: "baja",    dueOffset: 22  },
  { title: "Demo - Responder comentarios pendientes IG",          department: "Orgánico",     status: "en_progreso", priority: "media",   dueOffset: 1   },
  // Lanzamientos
  { title: "Demo - Crear pipeline para licitación NASA",          department: "Lanzamientos", status: "en_progreso", priority: "urgente", dueOffset: 6   },
  { title: "Demo - Revisar contrato GSA Schedule 70",             department: "Lanzamientos", status: "pendiente",   priority: "alta",    dueOffset: 11  },
  { title: "Demo - Onboarding cohort de mayo",                    department: "Lanzamientos", status: "pendiente",   priority: "alta",    dueOffset: 2   },
  { title: "Demo - Postmortem lanzamiento Q1",                    department: "Lanzamientos", status: "completada",  priority: "media",   dueOffset: -15 },
  { title: "Demo - Coordinar grabación de testimonios",           department: "Lanzamientos", status: "pendiente",   priority: "baja",    dueOffset: 30  },
  { title: "Demo - Actualizar deck de ventas v3",                 department: "Lanzamientos", status: "en_progreso", priority: "media",   dueOffset: -6  },
]

async function seedTasks() {
  console.log("\n[2/4] Tasks")

  // Fetch department UUIDs by name (asumimos que el seed de la migración ya los creó).
  const { data: deps } = await db.from("departments").select("id, name")
  const byName = new Map((deps ?? []).map((d: any) => [d.name, d.id as string]))

  // Idempotencia: borrar antes los tasks demo existentes para evitar duplicados.
  // (Usamos prefijo "Demo - " en el título como marker.)
  const { error: delErr } = await db
    .from("tasks").delete().like("title", `${DEMO_TITLE_PREFIX}%`)
  if (delErr) {
    console.error("  ✗ cleanup previo falló:", delErr.message)
    return 0
  }

  const rows = TASK_DEFS.map(t => {
    const teamMember = DEMO_TEAM.find(m => m.department === t.department)
    return {
      title:         t.title,
      status:        t.status,
      priority:      t.priority,
      department_id: byName.get(t.department) ?? null,
      owner:         teamMember?.email ?? null,
      assignees:     teamMember ? [teamMember.email] : [],
      due_at:        t.dueOffset === null ? null : daysFromNow(t.dueOffset),
      completed_at:  t.status === "completada" ? daysFromNow(t.dueOffset ?? 0) : null,
      created_by:    "seed-demo",
    }
  })

  const { error, data: inserted } = await db.from("tasks").insert(rows).select("id")
  if (error) {
    console.error("  ✗", error.message)
    return 0
  }
  console.log(`  ✓ ${inserted?.length ?? 0} tareas insertadas (5 por departamento)`)
  return inserted?.length ?? 0
}

// ─── 3) personas_agendadas ───────────────────────────────────────────────────

const PERSONA_DEFS = [
  { name: "Demo - John Doe",                callDays: -45, call: "atendida", sales: "cerrada",   rating: 5, owner: "demo-ana@govbidder-demo.com",    source: "LinkedIn" },
  { name: "Demo - Jane Roe",                callDays: -38, call: "atendida", sales: "propuesta", rating: 4, owner: "demo-luis@govbidder-demo.com",   source: "Webinar"  },
  { name: "Demo - Acme Corp",               callDays: -30, call: "no_show",  sales: "pendiente", rating: 3, owner: "demo-sofia@govbidder-demo.com",  source: "Ads"      },
  { name: "Demo - Tech Solutions Inc",      callDays: -22, call: "atendida", sales: "perdida",   rating: 2, owner: "demo-marcos@govbidder-demo.com", source: "Referido" },
  { name: "Demo - Federal Innovations LLC", callDays: -15, call: "atendida", sales: "cerrada",   rating: 5, owner: "demo-elena@govbidder-demo.com",  source: "Webinar"  },
  { name: "Demo - DataGov Partners",        callDays: -10, call: "atendida", sales: "propuesta", rating: 4, owner: "demo-ana@govbidder-demo.com",    source: "LinkedIn" },
  { name: "Demo - PrimeBid Services",       callDays: -7,  call: "reagendada", sales: "pendiente", rating: 3, owner: "demo-luis@govbidder-demo.com", source: "Web"      },
  { name: "Demo - StateContract Co",        callDays: -4,  call: "atendida", sales: "propuesta", rating: 4, owner: "demo-sofia@govbidder-demo.com",  source: "Ads"      },
  { name: "Demo - CapitolBids LLC",         callDays: -1,  call: "atendida", sales: "pendiente", rating: 4, owner: "demo-marcos@govbidder-demo.com", source: "Referido" },
  { name: "Demo - EastCoast Procurement",   callDays: 2,   call: "agendada", sales: "pendiente", rating: 3, owner: "demo-elena@govbidder-demo.com",  source: "LinkedIn" },
  { name: "Demo - WestGov Solutions",       callDays: 5,   call: "agendada", sales: "pendiente", rating: 4, owner: "demo-ana@govbidder-demo.com",    source: "Webinar"  },
  { name: "Demo - Pacific Bidwell Group",   callDays: 9,   call: "agendada", sales: "pendiente", rating: 3, owner: "demo-luis@govbidder-demo.com",   source: "Web"      },
]

async function seedPersonasAndSeguimientos() {
  console.log("\n[3/4] Personas agendadas + seguimientos")

  // Idempotencia: limpiar primero.
  await db.from("personas_agendadas").delete().like("name", `${DEMO_PERSONA_PREFIX}%`)

  const rows = PERSONA_DEFS.map(p => ({
    name:         p.name,
    email:        p.name.replace(/^Demo - /, "").toLowerCase().replace(/\s+/g, "_") + "@demo.com",
    scheduled_at: daysFromNow(p.callDays),
    call_status:  p.call,
    sales_status: p.sales,
    owner:        p.owner,
    source:       p.source,
    rating:       p.rating,
    notes:        `${DEMO_SEGUIMIENTO_PREFIX}Nota inicial del seed (rating ${p.rating}/5)`,
  }))

  const { data: created, error } = await db.from("personas_agendadas").insert(rows).select("id, name")
  if (error) {
    console.error("  ✗ personas:", error.message)
    return { personas: 0, seguimientos: 0 }
  }
  console.log(`  ✓ ${created?.length ?? 0} personas insertadas`)

  // Seguimientos para las primeras 8 (no las futuras).
  const followups = (created ?? []).slice(0, 8).map((p: any, i) => ({
    persona_id: p.id,
    type:       (["nota", "llamada", "mensaje", "email", "reunion"] as const)[i % 5],
    content:    `${DEMO_SEGUIMIENTO_PREFIX}Follow-up #${i + 1} sobre ${p.name}. Próximo paso: revisar propuesta.`,
    completed:  i % 2 === 0,
    owner:      "demo-ana@govbidder-demo.com",
  }))

  if (followups.length === 0) return { personas: created?.length ?? 0, seguimientos: 0 }

  const { error: segErr, data: segData } = await db.from("seguimientos").insert(followups).select("id")
  if (segErr) {
    console.error("  ✗ seguimientos:", segErr.message)
    return { personas: created?.length ?? 0, seguimientos: 0 }
  }
  console.log(`  ✓ ${segData?.length ?? 0} seguimientos insertados`)
  return { personas: created?.length ?? 0, seguimientos: segData?.length ?? 0 }
}

// ─── 4) Profiles + auth users ────────────────────────────────────────────────

async function seedProfiles() {
  console.log("\n[4/4] Profiles + auth users")

  // Fetch department UUIDs by name.
  const { data: deps } = await db.from("departments").select("id, name")
  const byName = new Map((deps ?? []).map((d: any) => [d.name, d.id as string]))

  // Listar auth users existentes para idempotencia (no recrear).
  const { data: existingUsers } = await db.auth.admin.listUsers({ perPage: 200 })
  const existingByEmail = new Map(
    (existingUsers?.users ?? []).map(u => [u.email ?? "", u])
  )

  let created = 0, updated = 0

  for (const m of DEMO_TEAM) {
    let userId: string

    const existing = existingByEmail.get(m.email)
    if (existing) {
      userId = existing.id
      // Reset password por si cambió DEMO_PASSWORD entre corridas.
      await db.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD })
    } else {
      const { data: newUser, error: createErr } = await db.auth.admin.createUser({
        email:         m.email,
        password:      DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: m.name, role: "user" },
      })
      if (createErr || !newUser.user) {
        console.error(`  ✗ creando ${m.email}:`, createErr?.message ?? "sin user")
        continue
      }
      userId = newUser.user.id
      created++
    }

    // Upsert profile (el trigger on_auth_user_created lo creó al insertar el user,
    // pero acá lo enriquecemos con department_id, position, status).
    const { error: profileErr } = await db
      .from("profiles")
      .upsert(
        {
          id:            userId,
          full_name:     m.name,
          role:          "user",
          position:      m.position,
          status:        "activo",
          department_id: byName.get(m.department) ?? null,
        } as any,
        { onConflict: "id" }
      )
    if (profileErr) {
      console.error(`  ✗ profile ${m.email}:`, profileErr.message)
      continue
    }
    if (existing) updated++
  }

  console.log(`  ✓ ${created} usuarios creados, ${updated} actualizados (total: ${DEMO_TEAM.length})`)
  console.log(`  ℹ Password compartido para todos: ${DEMO_PASSWORD}`)
  return { created, updated }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗")
  console.log("║  Seed de data demo — GovBidder Dashboard                    ║")
  console.log("╚════════════════════════════════════════════════════════════╝")

  const reports = await seedMonthlyReports()
  // Profiles antes que tasks/personas para que los emails owner/assignee
  // referencien usuarios que ya existen (mejor UX en /admin/team y conteos).
  const { created, updated } = await seedProfiles()
  const tasks = await seedTasks()
  const { personas, seguimientos } = await seedPersonasAndSeguimientos()

  console.log("\n────────────────────────────────────────────────────────────")
  console.log("Resumen:")
  console.log(`  monthly_reports:    ${reports}`)
  console.log(`  profiles (auth):    ${created} creados, ${updated} actualizados`)
  console.log(`  tasks:              ${tasks}`)
  console.log(`  personas_agendadas: ${personas}`)
  console.log(`  seguimientos:       ${seguimientos}`)
  console.log(`\n  Login demo: cualquier email demo-*@govbidder-demo.com`)
  console.log(`  Password:   ${DEMO_PASSWORD}`)
  console.log("\nPara borrar todo lo seedeado: pnpm cleanup:demo")
}

main().catch(e => {
  console.error("\n✗ Error fatal:", e)
  process.exit(1)
})
