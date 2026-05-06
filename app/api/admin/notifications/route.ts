import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

// GET — list notifications for the current user
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user || !user.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const url = new URL(req.url)
  const onlyUnread = url.searchParams.get("unread") === "1"
  const limit      = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200)

  const db = createServiceClient()
  let q = db.from("notifications").select("*").eq("recipient", user.email)
  if (onlyUnread) q = q.is("read_at", null)
  q = q.order("created_at", { ascending: false }).limit(limit)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also include the unread count for the bell badge
  const { count: unreadCount } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient", user.email)
    .is("read_at", null)

  return NextResponse.json({ notifications: data ?? [], unreadCount: unreadCount ?? 0 })
}

// PATCH — mark notification(s) as read
//   body: { id?: string, all?: boolean }
export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user || !user.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }

  const db = createServiceClient()
  const now = new Date().toISOString()

  if (body.all) {
    const { error } = await db
      .from("notifications")
      .update({ read_at: now })
      .eq("recipient", user.email)
      .is("read_at", null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.id) {
    const { error } = await db
      .from("notifications")
      .update({ read_at: now })
      .eq("id", body.id)
      .eq("recipient", user.email)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Falta id o all" }, { status: 400 })
}

// DELETE — remove a notification (cleanup, opcional)
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user || !user.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }

  if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db
    .from("notifications")
    .delete()
    .eq("id", body.id)
    .eq("recipient", user.email)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
