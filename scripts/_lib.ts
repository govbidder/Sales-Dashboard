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

/** Miembros demo del equipo. Se crean como usuarios auth + profile (rol=user, empleado). */
export const DEMO_TEAM = [
  { name: "Ana García",    email: "demo-ana@govbidder-demo.com",    department: "IA",           position: "Lead IA"             },
  { name: "Luis Pérez",    email: "demo-luis@govbidder-demo.com",   department: "Marketing",    position: "Marketing Manager"   },
  { name: "Sofía Ramírez", email: "demo-sofia@govbidder-demo.com",  department: "Anuncios",     position: "Ads Specialist"      },
  { name: "Marcos López",  email: "demo-marcos@govbidder-demo.com", department: "Orgánico",     position: "Content Lead"        },
  { name: "Elena Castro",  email: "demo-elena@govbidder-demo.com",  department: "Lanzamientos", position: "Launch Coordinator"  },
]
