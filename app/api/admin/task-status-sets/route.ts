import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

// GET — list all status sets
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from("task_status_sets")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name")

  if (error) {
    // If the table doesn't exist yet (migration not applied), return a graceful fallback
    return NextResponse.json({
      sets: [{
        id: "_fallback_default",
        name: "Default",
        description: "Hardcoded fallback (aplicá la migration 20250505000003).",
        is_default: true,
        statuses: [
          { key: "pendiente",   label: "Pendiente",   color: "#94a3b8", terminal: false },
          { key: "en_progreso", label: "En progreso", color: "#1e3a8a", terminal: false },
          { key: "completada",  label: "Completada",  color: "#10b981", terminal: true  },
          { key: "cancelada",   label: "Cancelada",   color: "#71717a", terminal: true  },
        ],
      }],
      fallback: true,
    })
  }
  return NextResponse.json({ sets: data ?? [] })
}
