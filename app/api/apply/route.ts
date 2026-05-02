import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      first_name, last_name, email, whatsapp, instagram_handle,
      primary_channel, short_content_link, youtube_podcast_link,
      email_list_size, monthly_revenue, paying_clients, client_work_style,
      income_goal, main_blocker, superpowers, contribution, motivation,
      one_year_goal, terms_accepted,
    } = body

    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Nombre, apellido y email son requeridos" }, { status: 400 })
    }

    const db = createServiceClient()
    const { data, error } = await db
      .from("applications")
      .insert({
        first_name:           first_name?.trim(),
        last_name:            last_name?.trim(),
        email:                email?.trim(),
        whatsapp:             whatsapp?.trim() || null,
        instagram_handle:     instagram_handle?.trim() || null,
        primary_channel:      primary_channel || null,
        short_content_link:   short_content_link?.trim() || null,
        youtube_podcast_link: youtube_podcast_link?.trim() || null,
        email_list_size:      email_list_size || null,
        monthly_revenue:      monthly_revenue || null,
        paying_clients:       paying_clients || null,
        client_work_style:    client_work_style || null,
        income_goal:          income_goal || null,
        main_blocker:         main_blocker?.trim() || null,
        superpowers:          superpowers?.trim() || null,
        contribution:         contribution?.trim() || null,
        motivation:           motivation?.trim() || null,
        one_year_goal:        one_year_goal?.trim() || null,
        terms_accepted:       terms_accepted === true,
        status:               "nueva",
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ application: data })
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
