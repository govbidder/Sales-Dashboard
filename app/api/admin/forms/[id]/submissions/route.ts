import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServiceClient } from "@/lib/supabase-service"

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await createClient().auth.getUser(token)
  return user
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await ctx.params
  const db = createServiceClient()
  const { data, error } = await db
    .from("task_form_submissions")
    .select("id, form_id, task_id, submitter_email, submitter_name, payload, created_at")
    .eq("form_id", id)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submissions: data ?? [] })
}
