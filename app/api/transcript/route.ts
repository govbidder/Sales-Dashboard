import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"
import { YoutubeTranscript } from "youtube-transcript"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?&#]+)/,
    /youtube\.com\/embed\/([^?&#]+)/,
    /youtube\.com\/shorts\/([^?&#]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

async function fetchYouTubeMeta(videoId: string) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
    if (!res.ok) return null
    const data = await res.json()
    return {
      title:     data.title as string,
      creator:   data.author_name as string,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from("transcript_history")
    .select("id, url, title, creator, duration, summary, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { url, platform = "youtube" } = body

  if (!url?.trim()) return NextResponse.json({ error: "URL requerida" }, { status: 400 })

  if (platform !== "youtube") {
    return NextResponse.json({ error: "Solo YouTube está soportado por ahora" }, { status: 400 })
  }

  const videoId = extractYouTubeId(url.trim())
  if (!videoId) return NextResponse.json({ error: "URL de YouTube inválida" }, { status: 400 })

  // Fetch transcript
  let transcriptLines: Array<{ text: string }> = []
  try {
    transcriptLines = await YoutubeTranscript.fetchTranscript(videoId)
  } catch (err: any) {
    const msg = err?.message ?? ""
    if (msg.includes("disabled")) {
      return NextResponse.json({ error: "Este video no tiene transcripciones disponibles." }, { status: 422 })
    }
    return NextResponse.json({ error: "No se pudo obtener el transcript: " + msg }, { status: 422 })
  }

  const transcript = transcriptLines.map(l => l.text).join(" ").replace(/\s+/g, " ").trim()
  const wordCount = transcript.split(/\s+/).length
  const durationSecs = transcriptLines.length > 0 ? Math.round(transcriptLines.length * 1.5) : 0
  const duration = durationSecs > 60
    ? `${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s`
    : `${durationSecs}s`

  const meta = await fetchYouTubeMeta(videoId)

  const db = createServiceClient()
  const { data: saved, error: saveErr } = await db
    .from("transcript_history")
    .insert({
      user_id:    user.id,
      url:        url.trim(),
      title:      meta?.title ?? `Video ${videoId}`,
      creator:    meta?.creator ?? null,
      duration,
      transcript,
      summary:    null,
    })
    .select()
    .single()

  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  return NextResponse.json({
    id:         saved.id,
    creator:    meta?.creator ?? null,
    title:      meta?.title ?? `Video ${videoId}`,
    thumbnail:  meta?.thumbnail ?? null,
    duration,
    wordCount,
    transcript,
    summary:    null,
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
    .from("transcript_history")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
