/**
 * Helpers compartidos entre seed-demo-data.ts y cleanup-demo-data.ts.
 *
 * - Carga env desde .env.local / .env (sin dotenv — parse manual).
 * - Crea cliente Supabase con service role para bypassear RLS.
 * - Constantes compartidas (rango de meses demo, prefijos, etc).
 */

import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

// ─── Env loader (lee .env.local con prioridad sobre .env) ────────────────────

function loadEnvFile(path: string) {
  if (!existsSync(path)) return
  const text = readFileSync(path, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    // Strip surrounding quotes if present.
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

const cwd = process.cwd()
loadEnvFile(resolve(cwd, ".env.local"))
loadEnvFile(resolve(cwd, ".env"))

// ─── Supabase service client ─────────────────────────────────────────────────

export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("✗ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local")
    process.exit(1)
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── Demo data constants ─────────────────────────────────────────────────────

/** Rango de meses que el seed cubre: mayo 2025 → abril 2026 (12 meses). */
export const DEMO_MONTHS_START = "2025-05-01"
export const DEMO_MONTHS_END   = "2026-04-01"

/** Prefijos identificables para que cleanup pueda borrar selectivamente. */
export const DEMO_TITLE_PREFIX        = "Demo - "
export const DEMO_PERSONA_PREFIX      = "Demo - "
export const DEMO_SEGUIMIENTO_PREFIX  = "Demo - "
export const DEMO_PROFILE_EMAIL_GLOB  = "demo-%@govbidder-demo.com"

/** Password compartido para todos los usuarios demo (login en la presentación). */
export const DEMO_PASSWORD = "DemoGovBidder2026!"

/** Role values used in seeds (mantienen sincronizado con lib/types/role.ts). */
type DemoRole = "super_admin" | "admin" | "user"

/**
 * Miembros demo del equipo (20 total). Mix de roles para mostrar en
 * la presentación cómo cambia la vista según el rol:
 * - 1 super_admin (ve todo + puede manejar admins)
 * - 2 admins (vista operativa completa)
 * - 5 leads + 12 miembros (rol user/empleado, scoped a su depto)
 *
 * Se crean como auth users con DEMO_PASSWORD; el trigger de profile los
 * registra automáticamente y después el seed completa department_id + role.
 */
export const DEMO_TEAM: Array<{
  name:       string
  email:      string
  position:   string
  department: string | null  // null = sin depto (admins corporativos)
  role:       DemoRole
}> = [
  // Top: super_admin + 2 admins (no dept — vista cross-empresa)
  { name: "Cristóbal Mendoza", email: "demo-cristobal@govbidder-demo.com", department: null,           position: "Director General",   role: "super_admin" },
  { name: "Diana Ruiz",        email: "demo-diana@govbidder-demo.com",    department: null,           position: "Directora Operaciones", role: "admin"   },
  { name: "Marcelo Fontana",   email: "demo-marcelo@govbidder-demo.com",  department: null,           position: "CFO",                role: "admin"      },

  // IA (3): lead + 2 miembros
  { name: "Ana García",        email: "demo-ana@govbidder-demo.com",      department: "IA",           position: "Lead IA",            role: "user"       },
  { name: "Diego Vásquez",     email: "demo-diego@govbidder-demo.com",    department: "IA",           position: "ML Engineer",        role: "user"       },
  { name: "Camila Pérez",      email: "demo-camila@govbidder-demo.com",   department: "IA",           position: "Data Scientist",     role: "user"       },

  // Marketing (3)
  { name: "Luis Pérez",        email: "demo-luis@govbidder-demo.com",     department: "Marketing",    position: "Marketing Manager",  role: "user"       },
  { name: "Florencia Vega",    email: "demo-florencia@govbidder-demo.com",department: "Marketing",    position: "Content Strategist", role: "user"       },
  { name: "Tomás Sosa",        email: "demo-tomas@govbidder-demo.com",    department: "Marketing",    position: "Brand Designer",     role: "user"       },

  // Anuncios (4 — más volumen porque ads requiere análisis constante)
  { name: "Sofía Ramírez",     email: "demo-sofia@govbidder-demo.com",    department: "Anuncios",     position: "Ads Lead",           role: "user"       },
  { name: "Hugo Cabrera",      email: "demo-hugo@govbidder-demo.com",     department: "Anuncios",     position: "Media Buyer",        role: "user"       },
  { name: "Valentina Ortega",  email: "demo-valentina@govbidder-demo.com",department: "Anuncios",     position: "Performance Analyst",role: "user"       },
  { name: "Mateo Salas",       email: "demo-mateo@govbidder-demo.com",    department: "Anuncios",     position: "Ads Creative",       role: "user"       },

  // Orgánico (3)
  { name: "Marcos López",      email: "demo-marcos@govbidder-demo.com",   department: "Orgánico",     position: "Content Lead",       role: "user"       },
  { name: "Bianca Aguirre",    email: "demo-bianca@govbidder-demo.com",   department: "Orgánico",     position: "SEO Specialist",     role: "user"       },
  { name: "Renata Espina",     email: "demo-renata@govbidder-demo.com",   department: "Orgánico",     position: "Social Media",       role: "user"       },

  // Lanzamientos (4 — equipo grande porque coordina launches)
  { name: "Elena Castro",      email: "demo-elena@govbidder-demo.com",    department: "Lanzamientos", position: "Launch Lead",        role: "user"       },
  { name: "Joaquín Méndez",    email: "demo-joaquin@govbidder-demo.com",  department: "Lanzamientos", position: "Project Manager",    role: "user"       },
  { name: "Lucía Romero",      email: "demo-lucia@govbidder-demo.com",    department: "Lanzamientos", position: "Sales Coordinator",  role: "user"       },
  { name: "Iván Torres",       email: "demo-ivan@govbidder-demo.com",     department: "Lanzamientos", position: "Onboarding Manager", role: "user"       },
]
