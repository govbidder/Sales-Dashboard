import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from("video_feed_accounts")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ account: data ?? null })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { channel_url } = body

  if (!channel_url?.trim()) {
    return NextResponse.json({ error: "channel_url es requerido" }, { status: 400 })
  }

  // Extract username from Instagram URL
  const match = channel_url.trim().replace(/\/$/, "").match(/instagram\.com\/([^/?#]+)/)
  const username = match?.[1] ?? channel_url.trim()

  // Store/update the account (no real scraping without an API key — store what we have)
  const db = createServiceClient()
  const { data, error } = await db
    .from("video_feed_accounts")
    .upsert({
      user_id:        user.id,
      platform:       "instagram",
      channel_url:    channel_url.trim(),
      channel_name:   username,
      channel_avatar: null,
      posts:          [],
      updated_at:     new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    channelUrl:    data.channel_url,
    channelName:   data.channel_name,
    channelAvatar: data.channel_avatar,
    posts:         data.posts ?? [],
  })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()
  const { error } = await db
    .from("video_feed_accounts")
    .delete()
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
