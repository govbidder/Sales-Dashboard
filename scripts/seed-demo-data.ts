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
      qualified_calls:      Math.round(attended * 0.65),
      no_show:              Math.max(0, scheduled - attended - 2),
      open_conversations:   lerpInt(35, 120, t),
      aplications:          lerpInt(50, 150, t),
      new_clients:          lerpInt(5, 15, t),
      offer_docs_sent:      sent,
      offer_docs_responded: responded,
      cierres_por_offerdoc: Math.round(responded * 0.40),
      cash_collected:       lerpInt(8000, 25000, t),
      total_revenue:        Math.round(lerpInt(8000, 25000, t) * 1.2),
      mrr:                  lerpInt(5000, 20000, t),
      ad_spend:             lerpInt(2000, 6000, t),
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
  tags?:      string[]
}

const TASK_DEFS: DemoTaskDef[] = [
  // ─── IA (12) ──────────────────────────────────────────────────────────
  { title: "Demo - Setup automation flujo de leads",              department: "IA",           status: "en_progreso", priority: "alta",    dueOffset: 3,   tags: ["automation", "leads"]    },
  { title: "Demo - Entrenar modelo de clasificación de RFPs",     department: "IA",           status: "pendiente",   priority: "media",   dueOffset: 10,  tags: ["ml", "rfp"]              },
  { title: "Demo - Conectar Anthropic API con el CRM",            department: "IA",           status: "completada",  priority: "alta",    dueOffset: -5,  tags: ["integration"]            },
  { title: "Demo - Auditoría compliance SAM.gov",                 department: "IA",           status: "pendiente",   priority: "urgente", dueOffset: -2,  tags: ["compliance", "audit"]    },
  { title: "Demo - Documentar prompts del email composer",        department: "IA",           status: "en_progreso", priority: "baja",    dueOffset: 14,  tags: ["docs"]                   },
  { title: "Demo - Implementar embeddings para búsqueda RFP",     department: "IA",           status: "pendiente",   priority: "alta",    dueOffset: 18,  tags: ["search"]                 },
  { title: "Demo - Fix bug en standup AI (timeouts)",             department: "IA",           status: "completada",  priority: "urgente", dueOffset: -8,  tags: ["bug", "standup"]         },
  { title: "Demo - Investigar Claude Sonnet 4.6 vs 4.5",          department: "IA",           status: "completada",  priority: "media",   dueOffset: -12, tags: ["research"]               },
  { title: "Demo - Setup eval suite para diagnósticos",           department: "IA",           status: "en_progreso", priority: "media",   dueOffset: 8,   tags: ["eval", "qa"]             },
  { title: "Demo - Cache de embeddings en Postgres",              department: "IA",           status: "pendiente",   priority: "baja",    dueOffset: 25,  tags: ["performance"]            },
  { title: "Demo - Monitorear costos de API (Anthropic)",         department: "IA",           status: "en_progreso", priority: "media",   dueOffset: 5,   tags: ["ops", "cost"]            },
  { title: "Demo - PoC: clasificación automática de oportunidades",department: "IA",          status: "pendiente",   priority: "alta",    dueOffset: 21,  tags: ["poc"]                    },

  // ─── Marketing (12) ───────────────────────────────────────────────────
  { title: "Demo - Diseñar campaña Q2 para LinkedIn",             department: "Marketing",    status: "en_progreso", priority: "alta",    dueOffset: 5,   tags: ["campaign", "linkedin"]   },
  { title: "Demo - Coordinar webinar de lanzamiento",             department: "Marketing",    status: "pendiente",   priority: "alta",    dueOffset: 7,   tags: ["webinar"]                },
  { title: "Demo - Revisar copy del landing principal",           department: "Marketing",    status: "completada",  priority: "media",   dueOffset: -8,  tags: ["copy", "landing"]        },
  { title: "Demo - Reporte de NPS Q1",                            department: "Marketing",    status: "pendiente",   priority: "media",   dueOffset: -1,  tags: ["nps", "reporting"]       },
  { title: "Demo - Newsletter de mayo",                           department: "Marketing",    status: "pendiente",   priority: "baja",    dueOffset: 20,  tags: ["email"]                  },
  { title: "Demo - Rediseño del onboarding email sequence",       department: "Marketing",    status: "en_progreso", priority: "media",   dueOffset: 12,  tags: ["email", "onboarding"]    },
  { title: "Demo - Brief para nueva imagen de marca",             department: "Marketing",    status: "completada",  priority: "alta",    dueOffset: -20, tags: ["branding"]               },
  { title: "Demo - Plan editorial trimestral",                    department: "Marketing",    status: "pendiente",   priority: "alta",    dueOffset: 4,   tags: ["planning"]               },
  { title: "Demo - Optimizar CTAs del sitio (test 3 variantes)",  department: "Marketing",    status: "en_progreso", priority: "media",   dueOffset: -3,  tags: ["cro", "ab-test"]         },
  { title: "Demo - Coordinar caso de éxito con cliente cerrado",  department: "Marketing",    status: "pendiente",   priority: "media",   dueOffset: 9,   tags: ["case-study"]             },
  { title: "Demo - Estudio competencia: top 5 players",           department: "Marketing",    status: "completada",  priority: "baja",    dueOffset: -25, tags: ["research"]               },
  { title: "Demo - Lanzar página de pricing v2",                  department: "Marketing",    status: "en_progreso", priority: "alta",    dueOffset: 16,  tags: ["pricing", "landing"]     },

  // ─── Anuncios (12) ────────────────────────────────────────────────────
  { title: "Demo - Analizar performance ads YouTube",             department: "Anuncios",     status: "en_progreso", priority: "alta",    dueOffset: 2,   tags: ["youtube", "analysis"]    },
  { title: "Demo - Setup retargeting Meta Ads",                   department: "Anuncios",     status: "pendiente",   priority: "media",   dueOffset: 8,   tags: ["meta", "retargeting"]    },
  { title: "Demo - Pausar campañas con CPL > $80",                department: "Anuncios",     status: "completada",  priority: "urgente", dueOffset: -3,  tags: ["optimization"]           },
  { title: "Demo - A/B test creatividades de licitaciones",       department: "Anuncios",     status: "en_progreso", priority: "media",   dueOffset: 12,  tags: ["ab-test", "creatives"]   },
  { title: "Demo - Reporte semanal de ROAS",                      department: "Anuncios",     status: "pendiente",   priority: "baja",    dueOffset: -4,  tags: ["reporting", "roas"]      },
  { title: "Demo - Test 5 variaciones de hook para Reels",        department: "Anuncios",     status: "en_progreso", priority: "alta",    dueOffset: 6,   tags: ["creative", "reels"]      },
  { title: "Demo - Lookalike audiences a partir de top spenders", department: "Anuncios",     status: "pendiente",   priority: "media",   dueOffset: 11,  tags: ["audiences"]              },
  { title: "Demo - Auditoría de creatividades pausadas Q1",       department: "Anuncios",     status: "completada",  priority: "baja",    dueOffset: -18, tags: ["audit"]                  },
  { title: "Demo - Negociar tarifas con plataforma de podcast",   department: "Anuncios",     status: "pendiente",   priority: "media",   dueOffset: 14,  tags: ["partnerships"]           },
  { title: "Demo - Escalar campaña 'High-ticket consult'",        department: "Anuncios",     status: "en_progreso", priority: "alta",    dueOffset: 3,   tags: ["scale"]                  },
  { title: "Demo - Tracking de UTMs + cleanup en CRM",            department: "Anuncios",     status: "pendiente",   priority: "media",   dueOffset: -5,  tags: ["tracking"]               },
  { title: "Demo - Reporte mensual de attribution",               department: "Anuncios",     status: "en_progreso", priority: "baja",    dueOffset: 1,   tags: ["attribution"]            },

  // ─── Orgánico (12) ────────────────────────────────────────────────────
  { title: "Demo - Publicar 3 reels esta semana",                 department: "Orgánico",     status: "en_progreso", priority: "media",   dueOffset: 4,   tags: ["reels"]                  },
  { title: "Demo - Investigar palabras clave GSA",                department: "Orgánico",     status: "pendiente",   priority: "media",   dueOffset: 9,   tags: ["seo", "keywords"]        },
  { title: "Demo - Calendario editorial de mayo",                 department: "Orgánico",     status: "completada",  priority: "alta",    dueOffset: -10, tags: ["planning"]               },
  { title: "Demo - SEO audit del blog",                           department: "Orgánico",     status: "pendiente",   priority: "baja",    dueOffset: 22,  tags: ["seo", "audit"]           },
  { title: "Demo - Responder comentarios pendientes IG",          department: "Orgánico",     status: "en_progreso", priority: "media",   dueOffset: 1,   tags: ["engagement"]             },
  { title: "Demo - Grabar 5 videos para TikTok",                  department: "Orgánico",     status: "pendiente",   priority: "alta",    dueOffset: 7,   tags: ["tiktok", "video"]        },
  { title: "Demo - Reescribir post 'Cómo ganar tu primera licitación'", department: "Orgánico", status: "completada", priority: "media", dueOffset: -14, tags: ["blog"]                   },
  { title: "Demo - Coordinar entrevista con cliente caso éxito",  department: "Orgánico",     status: "pendiente",   priority: "media",   dueOffset: 17,  tags: ["content"]                },
  { title: "Demo - Plan de YouTube Q2 (12 videos)",               department: "Orgánico",     status: "en_progreso", priority: "alta",    dueOffset: 10,  tags: ["youtube", "planning"]    },
  { title: "Demo - Crear thumbnails para últimos 6 videos",       department: "Orgánico",     status: "completada",  priority: "baja",    dueOffset: -7,  tags: ["design", "youtube"]      },
  { title: "Demo - Estudio de hashtags top performers Q1",        department: "Orgánico",     status: "pendiente",   priority: "baja",    dueOffset: 28,  tags: ["analysis"]               },
  { title: "Demo - Engagement push a posts virales reciclados",   department: "Orgánico",     status: "en_progreso", priority: "media",   dueOffset: -2,  tags: ["engagement"]             },

  // ─── Lanzamientos (12) ────────────────────────────────────────────────
  { title: "Demo - Crear pipeline para licitación NASA",          department: "Lanzamientos", status: "en_progreso", priority: "urgente", dueOffset: 6,   tags: ["pipeline", "nasa"]       },
  { title: "Demo - Revisar contrato GSA Schedule 70",             department: "Lanzamientos", status: "pendiente",   priority: "alta",    dueOffset: 11,  tags: ["legal", "gsa"]           },
  { title: "Demo - Onboarding cohort de mayo",                    department: "Lanzamientos", status: "pendiente",   priority: "alta",    dueOffset: 2,   tags: ["onboarding"]             },
  { title: "Demo - Postmortem lanzamiento Q1",                    department: "Lanzamientos", status: "completada",  priority: "media",   dueOffset: -15, tags: ["retrospective"]          },
  { title: "Demo - Coordinar grabación de testimonios",           department: "Lanzamientos", status: "pendiente",   priority: "baja",    dueOffset: 30,  tags: ["testimonials"]           },
  { title: "Demo - Actualizar deck de ventas v3",                 department: "Lanzamientos", status: "en_progreso", priority: "media",   dueOffset: -6,  tags: ["sales", "deck"]          },
  { title: "Demo - Outreach a 50 prospects warm Q2",              department: "Lanzamientos", status: "en_progreso", priority: "alta",    dueOffset: 4,   tags: ["outreach"]               },
  { title: "Demo - Setup demo environment para cliente Beta",     department: "Lanzamientos", status: "pendiente",   priority: "media",   dueOffset: 8,   tags: ["demo", "beta"]           },
  { title: "Demo - Revisar precios y ajustar pipeline 2026",      department: "Lanzamientos", status: "completada",  priority: "alta",    dueOffset: -22, tags: ["pricing"]                },
  { title: "Demo - Preparar materiales onboarding v2",            department: "Lanzamientos", status: "en_progreso", priority: "media",   dueOffset: 15,  tags: ["onboarding"]             },
  { title: "Demo - Coordinar evento webinar mayo",                department: "Lanzamientos", status: "pendiente",   priority: "media",   dueOffset: 13,  tags: ["webinar", "event"]       },
  { title: "Demo - Refinar funnel post-discovery call",           department: "Lanzamientos", status: "cancelada",   priority: "baja",    dueOffset: -30, tags: ["funnel"]                 },
]

async function seedTasks() {
  console.log("\n[3/4] Tasks")

  // Fetch department UUIDs by name (asumimos que el seed de la migración ya los creó).
  const { data: deps } = await db.from("departments").select("id, name")
  const byName = new Map((deps ?? []).map((d: any) => [d.name, d.id as string]))

  // Pre-computar la lista de miembros por depto (rol=user). Los admins/super_admin
  // no aparecen como owners de tasks operativas — esas pertenecen a los empleados.
  const membersByDept = new Map<string, typeof DEMO_TEAM>()
  for (const m of DEMO_TEAM) {
    if (m.role !== "user" || !m.department) continue
    const list = membersByDept.get(m.department) ?? []
    list.push(m)
    membersByDept.set(m.department, list)
  }

  // Idempotencia: borrar antes los tasks demo existentes para evitar duplicados.
  // (Usamos prefijo "Demo - " en el título como marker.)
  const { error: delErr } = await db
    .from("tasks").delete().like("title", `${DEMO_TITLE_PREFIX}%`)
  if (delErr) {
    console.error("  ✗ cleanup previo falló:", delErr.message)
    return 0
  }

  // Counter por depto para rotar owners (round-robin estable).
  const idxByDept = new Map<string, number>()

  const rows = TASK_DEFS.map(t => {
    const deptMembers = membersByDept.get(t.department) ?? []
    let owner: string | null = null
    let extraAssignees: string[] = []
    if (deptMembers.length > 0) {
      const i = idxByDept.get(t.department) ?? 0
      const ownerMember = deptMembers[i % deptMembers.length]
      owner = ownerMember.email
      idxByDept.set(t.department, i + 1)
      // 30% de las tasks suman un co-asignado del mismo depto (collab realista).
      if (deptMembers.length > 1 && (i % 10) >= 7) {
        const collab = deptMembers[(i + 1) % deptMembers.length]
        if (collab.email !== owner) extraAssignees = [collab.email]
      }
    }
    return {
      title:         t.title,
      status:        t.status,
      priority:      t.priority,
      department_id: byName.get(t.department) ?? null,
      owner,
      assignees:     owner ? [owner, ...extraAssignees] : [],
      tags:          t.tags ?? [],
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
  console.log(`  ✓ ${inserted?.length ?? 0} tareas insertadas (12 por departamento, owners rotativos)`)
  return inserted?.length ?? 0
}

// ─── 3) personas_agendadas ───────────────────────────────────────────────────

// 30 personas con mix realista de status, source, ratings y owners distribuidos.
const PERSONA_DEFS = [
  // Histórico: cerradas (5)
  { name: "Demo - John Doe",                callDays: -78, call: "atendida",   sales: "cerrada",   rating: 5, owner: "demo-elena@govbidder-demo.com",     source: "LinkedIn" },
  { name: "Demo - Federal Innovations LLC", callDays: -62, call: "atendida",   sales: "cerrada",   rating: 5, owner: "demo-lucia@govbidder-demo.com",     source: "Webinar"  },
  { name: "Demo - Jane Roe Consulting",     callDays: -55, call: "atendida",   sales: "cerrada",   rating: 5, owner: "demo-joaquin@govbidder-demo.com",   source: "Webinar"  },
  { name: "Demo - Northeast Procurement",   callDays: -42, call: "atendida",   sales: "cerrada",   rating: 5, owner: "demo-ivan@govbidder-demo.com",      source: "Referido" },
  { name: "Demo - StarBids Inc",            callDays: -35, call: "atendida",   sales: "cerrada",   rating: 4, owner: "demo-elena@govbidder-demo.com",     source: "LinkedIn" },
  // Histórico: perdidas (3)
  { name: "Demo - Tech Solutions Inc",      callDays: -68, call: "atendida",   sales: "perdida",   rating: 2, owner: "demo-lucia@govbidder-demo.com",     source: "Referido" },
  { name: "Demo - GreyDog Procurement",     callDays: -48, call: "atendida",   sales: "perdida",   rating: 2, owner: "demo-joaquin@govbidder-demo.com",   source: "Ads"      },
  { name: "Demo - Lakeside Bidwell",        callDays: -30, call: "atendida",   sales: "perdida",   rating: 3, owner: "demo-ivan@govbidder-demo.com",      source: "Web"      },
  // En curso: propuesta enviada (8)
  { name: "Demo - DataGov Partners",        callDays: -25, call: "atendida",   sales: "propuesta", rating: 4, owner: "demo-elena@govbidder-demo.com",     source: "LinkedIn" },
  { name: "Demo - StateContract Co",        callDays: -19, call: "atendida",   sales: "propuesta", rating: 4, owner: "demo-lucia@govbidder-demo.com",     source: "Ads"      },
  { name: "Demo - Acme Solutions",          callDays: -14, call: "atendida",   sales: "propuesta", rating: 5, owner: "demo-joaquin@govbidder-demo.com",   source: "Webinar"  },
  { name: "Demo - Capital Group LLC",       callDays: -11, call: "atendida",   sales: "propuesta", rating: 4, owner: "demo-ivan@govbidder-demo.com",      source: "Referido" },
  { name: "Demo - Bayside Federal Co",      callDays: -9,  call: "atendida",   sales: "propuesta", rating: 4, owner: "demo-elena@govbidder-demo.com",     source: "LinkedIn" },
  { name: "Demo - Compass Bidworks",        callDays: -8,  call: "atendida",   sales: "propuesta", rating: 3, owner: "demo-lucia@govbidder-demo.com",     source: "Web"      },
  { name: "Demo - Beacon Public Sector",    callDays: -6,  call: "atendida",   sales: "propuesta", rating: 4, owner: "demo-joaquin@govbidder-demo.com",   source: "Ads"      },
  { name: "Demo - Liberty GovTech",         callDays: -5,  call: "atendida",   sales: "propuesta", rating: 5, owner: "demo-ivan@govbidder-demo.com",      source: "Webinar"  },
  // En curso: pendiente (5)
  { name: "Demo - PrimeBid Services",       callDays: -4,  call: "atendida",   sales: "pendiente", rating: 3, owner: "demo-elena@govbidder-demo.com",     source: "Web"      },
  { name: "Demo - CapitolBids LLC",         callDays: -3,  call: "atendida",   sales: "pendiente", rating: 4, owner: "demo-lucia@govbidder-demo.com",     source: "Referido" },
  { name: "Demo - Pioneer Federal Group",   callDays: -2,  call: "atendida",   sales: "pendiente", rating: 4, owner: "demo-joaquin@govbidder-demo.com",   source: "LinkedIn" },
  { name: "Demo - Civic Procurement Hub",   callDays: -1,  call: "atendida",   sales: "pendiente", rating: 3, owner: "demo-ivan@govbidder-demo.com",      source: "Ads"      },
  { name: "Demo - Apex Public Affairs",     callDays: 0,   call: "atendida",   sales: "pendiente", rating: 4, owner: "demo-elena@govbidder-demo.com",     source: "Webinar"  },
  // Próximas: agendadas (6)
  { name: "Demo - EastCoast Procurement",   callDays: 2,   call: "agendada",   sales: "pendiente", rating: 3, owner: "demo-lucia@govbidder-demo.com",     source: "LinkedIn" },
  { name: "Demo - WestGov Solutions",       callDays: 5,   call: "agendada",   sales: "pendiente", rating: 4, owner: "demo-joaquin@govbidder-demo.com",   source: "Webinar"  },
  { name: "Demo - Pacific Bidwell Group",   callDays: 7,   call: "agendada",   sales: "pendiente", rating: 3, owner: "demo-ivan@govbidder-demo.com",      source: "Web"      },
  { name: "Demo - Atlas Government Co",     callDays: 9,   call: "agendada",   sales: "pendiente", rating: 4, owner: "demo-elena@govbidder-demo.com",     source: "Ads"      },
  { name: "Demo - Horizon BidCorp",         callDays: 12,  call: "agendada",   sales: "pendiente", rating: 3, owner: "demo-lucia@govbidder-demo.com",     source: "Referido" },
  { name: "Demo - Summit Federal LLC",      callDays: 15,  call: "agendada",   sales: "pendiente", rating: 4, owner: "demo-joaquin@govbidder-demo.com",   source: "LinkedIn" },
  // Edge cases: no_show + reagendadas (3)
  { name: "Demo - Acme Corp",               callDays: -45, call: "no_show",    sales: "pendiente", rating: 2, owner: "demo-elena@govbidder-demo.com",     source: "Ads"      },
  { name: "Demo - SilverTech Partners",     callDays: -10, call: "no_show",    sales: "pendiente", rating: 3, owner: "demo-lucia@govbidder-demo.com",     source: "Web"      },
  { name: "Demo - Skyline Procure Ltd",     callDays: 4,   call: "reagendada", sales: "pendiente", rating: 3, owner: "demo-joaquin@govbidder-demo.com",   source: "Webinar"  },
]

async function seedPersonasAndSeguimientos() {
  console.log("\n[4/4] Personas agendadas + seguimientos")

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

  const { data: created, error } = await db.from("personas_agendadas").insert(rows).select("id, name, owner")
  if (error) {
    console.error("  ✗ personas:", error.message)
    return { personas: 0, seguimientos: 0 }
  }
  console.log(`  ✓ ${created?.length ?? 0} personas insertadas`)

  // 25 seguimientos sobre las primeras 24 personas (saltea las futuras agendadas
  // sin contexto). Mix de tipos: nota / llamada / mensaje / email / reunion.
  const TYPES = ["nota", "llamada", "mensaje", "email", "reunion"] as const
  const CONTENT_TEMPLATES = [
    "Llamada de discovery: identificamos pain en {area}. Próximo paso: enviar OfferDoc esta semana.",
    "Mandó email pidiendo detalles de pricing. Pendiente: armar propuesta personalizada.",
    "Reunión técnica con su equipo. Necesitan integración con GSA Schedule 70 — chequear viabilidad.",
    "Follow-up por LinkedIn. Confirmó interés. Reagendar call para próxima semana.",
    "Nota interna: cliente reportó alto interés pero presupuesto pendiente. Seguir en 2 semanas.",
    "Mensaje de WhatsApp: pidió referencias de otros clientes. Mandar 2 casos relevantes.",
    "Llamada de cierre cancelada por cliente. Necesita aprobación interna primero.",
    "Email enviado con OfferDoc v2 ajustado a sus requerimientos.",
    "Reunión postergada por agenda interna del cliente. Reagendada para próximo jueves.",
    "Nota: marca alto interés pero objeción de pricing. Probar propuesta con tier inferior.",
  ]

  const eligiblePersonas = (created ?? []).slice(0, 24)
  const followups = Array.from({ length: 25 }, (_, i) => {
    const persona = eligiblePersonas[i % eligiblePersonas.length]
    const template = CONTENT_TEMPLATES[i % CONTENT_TEMPLATES.length]
      .replace("{area}", ["onboarding", "automation", "compliance", "scaling"][i % 4])
    return {
      persona_id: persona.id,
      type:       TYPES[i % TYPES.length],
      content:    `${DEMO_SEGUIMIENTO_PREFIX}${template}`,
      completed:  i % 3 !== 0,
      owner:      persona.owner ?? "demo-elena@govbidder-demo.com",
    }
  })

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
  console.log("\n[2/4] Profiles + auth users")

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
      // Reset password + role en metadata por si cambiaron entre corridas.
      await db.auth.admin.updateUserById(userId, {
        password:      DEMO_PASSWORD,
        user_metadata: { full_name: m.name, role: m.role },
      })
    } else {
      const { data: newUser, error: createErr } = await db.auth.admin.createUser({
        email:         m.email,
        password:      DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: m.name, role: m.role },
      })
      if (createErr || !newUser.user) {
        console.error(`  ✗ creando ${m.email}:`, createErr?.message ?? "sin user")
        continue
      }
      userId = newUser.user.id
      created++
    }

    // Upsert del profile. Solo seteamos campos que SABEMOS que existen tras
    // las migrations base (id, full_name, role, department_id). Status /
    // position se setean DESPUÉS de forma tolerante para no romper si la
    // migration team_profiles no fue aplicada o el cache de PostgREST está
    // stale (ver bug del promote-script PR #10).
    const baseUpsert: Record<string, unknown> = {
      id:            userId,
      full_name:     m.name,
      role:          m.role,
      department_id: m.department ? (byName.get(m.department) ?? null) : null,
    }
    const { error: profileErr } = await db
      .from("profiles")
      .upsert(baseUpsert, { onConflict: "id" })
    if (profileErr) {
      console.error(`  ✗ profile ${m.email}:`, profileErr.message)
      continue
    }

    // Position + status (best-effort — si la columna no existe, se ignora).
    const { error: extraErr } = await db
      .from("profiles")
      .update({ position: m.position, status: "activo" } as any)
      .eq("id", userId)
    if (extraErr && !/column .* does not exist|schema cache/i.test(extraErr.message)) {
      console.warn(`  ⚠ ${m.email} position/status:`, extraErr.message)
    }

    if (existing) updated++
  }

  // Contar por rol para mostrar resumen útil.
  const byRole = DEMO_TEAM.reduce((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(`  ✓ ${created} usuarios creados, ${updated} actualizados (total: ${DEMO_TEAM.length})`)
  console.log(`    super_admin: ${byRole.super_admin ?? 0} · admin: ${byRole.admin ?? 0} · user: ${byRole.user ?? 0}`)
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
