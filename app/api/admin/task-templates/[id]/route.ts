import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

// PATCH — update a template
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await ctx.params
  const body = await req.json()
  delete body.id  // prevent id override

  const db = createServiceClient()
  const { data, error } = await db
    .from("task_templates")
    .update(body)
    .eq("id", id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}

// DELETE — remove template
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params

  const db = createServiceClient()
  const { error } = await db.from("task_templates").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
