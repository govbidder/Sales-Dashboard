import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { rateLimit } from "@/lib/rate-limit"

interface FormField {
  key:         string
  label:       string
  type:        "text" | "longtext" | "email" | "phone" | "select" | "date"
  required?:   boolean
  placeholder?: string
  options?:    string[]
}

// GET — fetch the public form by slug (no auth required)
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const db = createServiceClient()
  const { data, error } = await db
    .from("task_forms")
    .select("id,slug,title,description,fields,is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .single()
  if (error || !data) {
    return NextResponse.json({ error: "Form no encontrado" }, { status: 404 })
  }
  return NextResponse.json({ form: data })
}

// POST — submit the form (no auth required, creates a task)
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params

  // Rate limit: 5 submits per IP per hour per form slug
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const rl = rateLimit({
    key:      `forms:${slug}:${ip}`,
    limit:    5,
    windowMs: 3600_000,   // 1 hour
  })
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error:        "Demasiados intentos. Probá de nuevo más tarde.",
        retryAfterMs: rl.retryAfterMs,
      },
      {
        status: 429,
        headers: {
          "Retry-After":           String(Math.ceil(rl.retryAfterMs / 1000)),
          "X-RateLimit-Limit":     String(rl.limit),
          "X-RateLimit-Remaining": String(rl.remaining),
        },
      }
    )
  }

  let body: Record<string, any>
  try { body = await req.json() } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }

  const db = createServiceClient()

  // 1) Load form
  const { data: form, error: fErr } = await db
    .from("task_forms")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single()
  if (fErr || !form) return NextResponse.json({ error: "Form no encontrado o inactivo" }, { status: 404 })

  // 2) Validate required fields
  const fields = (form.fields as FormField[]) ?? []
  for (const f of fields) {
    if (f.required && (!body[f.key] || String(body[f.key]).trim() === "")) {
      return NextResponse.json({ error: `Campo requerido: ${f.label}` }, { status: 400 })
    }
  }

  // 3) Build a task title + description from the submission
  const submitterName  = body.name  ? String(body.name).trim()  : null
  const submitterEmail = body.email ? String(body.email).trim() : null

  // Title: use opportunity / project / first text field, or generic
  const titleSource = body.opportunity || body.project || body.subject || body.title
                    || `Form: ${form.title}`
  const title = `[${form.title}] ${String(titleSource).slice(0, 80)}`

  // Description: render all field values
  const descLines: string[] = []
  if (submitterName)  descLines.push(`Nombre: ${submitterName}`)
  if (submitterEmail) descLines.push(`Email: ${submitterEmail}`)
  for (const f of fields) {
    if (f.key === "name" || f.key === "email") continue
    const val = body[f.key]
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      descLines.push(`${f.label}: ${val}`)
    }
  }
  const description = descLines.join("\n")

  // Optional due_at from a "deadline" field
  const dueAt = body.deadline && /^\d{4}-\d{2}-\d{2}/.test(body.deadline)
    ? new Date(body.deadline + "T18:00:00").toISOString()
    : null

  // 4) Insert task
  const { data: task, error: tErr } = await db
    .from("tasks")
    .insert({
      title,
      description,
      priority:   form.default_priority,
      tags:       form.default_tags ?? [],
      assignees:  form.default_assignees ?? [],
      due_at:     dueAt,
      status:     "pendiente",
      created_by: submitterEmail ?? "form:" + slug,
    })
    .select()
    .single()

  if (tErr || !task) {
    console.error("[forms submit] task insert error", tErr)
    return NextResponse.json({ error: "No pude crear la tarea" }, { status: 500 })
  }

  // 5) Audit submission
  const ua = req.headers.get("user-agent")
  await db.from("task_form_submissions").insert({
    form_id:        form.id,
    task_id:        task.id,
    submitter_email: submitterEmail,
    submitter_name:  submitterName,
    payload:        body,
    ip:             ip === "unknown" ? null : ip,
    user_agent:     ua,
  })

  // 6) Increment counter
  await db.from("task_forms")
    .update({ submit_count: (form.submit_count ?? 0) + 1 })
    .eq("id", form.id)

  return NextResponse.json({ ok: true, task_id: task.id })
}
