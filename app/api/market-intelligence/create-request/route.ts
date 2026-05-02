import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { platform, timeframe_days, competitors, access_token, client_id } = body

    if (!access_token) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const { data: { user } } = await createClient().auth.getUser(access_token)
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    if (!platform || !timeframe_days || !competitors) {
      return NextResponse.json({ error: "platform, timeframe_days y competitors son requeridos" }, { status: 400 })
    }

    const validPlatforms = ["youtube", "instagram", "tiktok"]
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json({ error: `platform debe ser uno de: ${validPlatforms.join(", ")}` }, { status: 400 })
    }

    const validTimeframes = [30, 60, 90]
    if (!validTimeframes.includes(Number(timeframe_days))) {
      return NextResponse.json({ error: "timeframe_days debe ser 30, 60 o 90" }, { status: 400 })
    }

    const filteredCompetitors = Array.isArray(competitors)
      ? competitors.filter((c: string) => c?.trim())
      : []

    const db = createServiceClient()
    const { data, error } = await db
      .from("research_requests")
      .insert({
        user_id:       user.id,
        client_id:     client_id ?? null,
        platform,
        timeframe_days: Number(timeframe_days),
        competitors:   filteredCompetitors,
        status:        "pending",
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ request: data })
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
