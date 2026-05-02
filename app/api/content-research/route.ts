import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

function extractChannelId(url: string): string | null {
  const m = url.match(/youtube\.com\/@([^/?&#]+)/)
    ?? url.match(/youtube\.com\/c\/([^/?&#]+)/)
    ?? url.match(/youtube\.com\/user\/([^/?&#]+)/)
    ?? url.match(/youtube\.com\/channel\/([^/?&#]+)/)
  return m?.[1] ?? null
}

interface VideoData {
  id: string
  title: string
  views: number
  likes: number
  comments: number
  published_at: string
  thumbnail: string
  url: string
  duration: string
}

async function fetchTopVideos(channelUrl: string, timeframeDays: number): Promise<{
  channelName: string
  channelAvatar: string | null
  videos: VideoData[]
}> {
  const handle = extractChannelId(channelUrl) ?? channelUrl.replace(/\/$/, "").split("/").pop() ?? "canal"

  // Use YouTube oEmbed + search API (public, no key needed for basic data)
  // Fetch channel page to get top videos
  const searchUrl = `https://www.youtube.com/@${handle}/videos`

  // Without YouTube Data API key we can only provide what's public via RSS
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?user=${handle}`
  const rssUrl2 = `https://www.youtube.com/feeds/videos.xml?channel_id=${handle}`

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - timeframeDays)

  let channelName = handle
  let videos: VideoData[] = []

  try {
    // Try RSS feed
    const rssRes = await fetch(rssUrl, { headers: { "User-Agent": "Mozilla/5.0" } })
    const xml = rssRes.ok ? await rssRes.text() : ""

    if (xml.includes("<feed")) {
      const titleMatch = xml.match(/<title>([^<]+)<\/title>/)
      if (titleMatch?.[1] && !titleMatch[1].includes("YouTube")) {
        channelName = titleMatch[1]
      }

      const entries = xml.split("<entry>").slice(1)
      for (const entry of entries.slice(0, 10)) {
        const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
        const titleMatch = entry.match(/<title>([^<]+)<\/title>/)
        const pubMatch = entry.match(/<published>([^<]+)<\/published>/)
        const viewsMatch = entry.match(/<media:statistics views="(\d+)"/)

        if (!idMatch) continue
        const pubDate = pubMatch ? new Date(pubMatch[1]) : new Date()
        if (pubDate < cutoff) continue

        const videoId = idMatch[1]
        videos.push({
          id:           videoId,
          title:        titleMatch?.[1]?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") ?? "Sin título",
          views:        Number(viewsMatch?.[1] ?? 0),
          likes:        0,
          comments:     0,
          published_at: pubDate.toISOString(),
          thumbnail:    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          url:          `https://www.youtube.com/watch?v=${videoId}`,
          duration:     "—",
        })
      }
    }
  } catch { /* RSS unavailable */ }

  // Sort by views desc, take top 5
  videos.sort((a, b) => b.views - a.views)
  videos = videos.slice(0, 5)

  return { channelName, channelAvatar: null, videos }
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from("content_research_history")
    .select("id, channel_url, channel_name, channel_avatar, timeframe_days, videos, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { channel_url, timeframe_days = 30 } = body

  if (!channel_url?.trim()) {
    return NextResponse.json({ error: "channel_url es requerido" }, { status: 400 })
  }

  const { channelName, channelAvatar, videos } = await fetchTopVideos(channel_url.trim(), Number(timeframe_days))

  const db = createServiceClient()
  const { error: saveErr } = await db
    .from("content_research_history")
    .insert({
      user_id:        user.id,
      channel_url:    channel_url.trim(),
      channel_name:   channelName,
      channel_avatar: channelAvatar,
      timeframe_days: Number(timeframe_days),
      platform:       "youtube",
      videos,
    })

  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  return NextResponse.json({
    channelName,
    channelAvatar,
    channelUrl: channel_url.trim(),
    timeframe_days: Number(timeframe_days),
    videos,
  })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db
    .from("content_research_history")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
