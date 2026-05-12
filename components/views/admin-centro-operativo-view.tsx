"use client"

import { useEffect, useState, useRef } from "react"
import {
  Cog, BookMarked, FolderKanban, KeyRound,
  Plus, ExternalLink, Trash2, Loader2, FolderOpen,
  Search, AlertTriangle, Link2, FileText, Video, File, X,
  ChevronRight, ArrowRight, Check, Copy, Pencil, Save,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Portal } from "@/components/ui/portal"
import { createClient } from "@/lib/supabase"
import { type Role, isAdminOrAbove } from "@/lib/types/role"
import { canModifyResource } from "@/lib/auth/can-modify-resource"

// ─── Types ────────────────────────────────────────────────────────────────────

type ResourceType = "link" | "doc" | "video" | "file"

interface Item {
  id: string
  title: string
  url: string
  description: string | null
  content: string | null
  category: string
  type: ResourceType
  department_id: string | null
  created_at: string
}

interface Department {
  id: string
  name: string
  color: string
  sort_order: number
}

// Sentinel para "Sin asignar" en el filtro/selector (chip clickeable que
// representa el null en department_id).
const NO_DEPT_ID = "__no_dept__"

// ─── Config ───────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: "sop-sistemas",
    label: "SOPs de Sistemas",
    icon: Cog,
    color: "text-blue-600",
    accent: "border-blue-400/20 bg-blue-400/5",
    desc: "Automatizaciones, integraciones y documentación técnica de herramientas.",
  },
  {
    id: "sop-operativos",
    label: "SOPs Operativos",
    icon: BookMarked,
    color: "text-green-400",
    accent: "border-green-400/20 bg-green-400/5",
    desc: "Procesos internos paso a paso: onboarding, seguimiento, cierre.",
  },
  {
    id: "recursos-internos",
    label: "Recursos Internos",
    icon: FolderKanban,
    color: "text-purple-600",
    accent: "border-purple-400/20 bg-purple-400/5",
    desc: "Links, plantillas, documentos y materiales del equipo.",
  },
  {
    id: "accesos",
    label: "Accesos y Herramientas",
    icon: KeyRound,
    color: "text-amber-600",
    accent: "border-amber-400/20 bg-amber-400/5",
    desc: "Referencia de herramientas del stack. No guardar contraseñas en texto plano.",
  },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

const TYPE_CONFIG: Record<ResourceType, { label: string; icon: React.ElementType; color: string }> = {
  link:  { label: "Link",    icon: Link2,    color: "text-blue-600"   },
  doc:   { label: "Doc",     icon: FileText,  color: "text-green-400"  },
  video: { label: "Video",   icon: Video,     color: "text-purple-600" },
  file:  { label: "Archivo", icon: File,      color: "text-amber-600"  },
}

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: Record<SectionId, { label: string; content: string }[]> = {
  "sop-sistemas": [
    {
      label: "SOP de herramienta",
      content: `## ¿Qué hace esta herramienta?
[Describir en 1-2 líneas para qué sirve]

## Automatizaciones existentes
- Automatización 1: [qué hace, qué dispara, qué produce]
- Automatización 2: [qué hace, qué dispara, qué produce]

## Herramientas que conecta
→ [Herramienta A] → [Herramienta B] → [Resultado]

## Cómo acceder
- URL:
- Usuario: [ver gestor de claves]
- Documentación:

## Qué hacer si hay un error
1. Verificar [paso 1]
2. Revisar [paso 2]
3. Si persiste: contactar a [responsable]

## Dónde revisar cada automatización
- [Link al panel]`,
    },
  ],
  "sop-operativos": [
    {
      label: "SOP de proceso",
      content: `## Objetivo del proceso
[Qué logra este proceso y cuándo se activa]

## Paso a paso

→ Paso 1: [Acción]
   - Qué hacer:
   - Link:
   - Herramienta:

→ Paso 2: [Acción]
   - Qué hacer:
   - Link:
   - Herramienta:

→ Paso 3: [Acción]
   - Qué hacer:
   - Link:
   - Herramienta:

## Herramientas involucradas
- [Herramienta 1]
- [Herramienta 2]

## Qué revisar si algo falla
1. [Check 1]
2. [Check 2]
3. Escalar a: [responsable]

## Links útiles
- [Link 1]:
- [Link 2]: `,
    },
    {
      label: "SOP de onboarding",
      content: `## Objetivo
Dar de alta a un nuevo cliente en todos los sistemas de GovBidder.

## Paso a paso

→ Paso 1: Crear perfil en el CRM
   - Ir a: govbidder.com/admin/clients
   - Completar: nombre, email, canal, programa, cuotas

→ Paso 2: Enviar accesos al cliente
   - Herramienta: [email / Slack]
   - Template: [link al template]

→ Paso 3: Configurar en Zapier
   - Automatización: [nombre de la zap]
   - Verificar que se dispare correctamente

→ Paso 4: Agendar primera llamada
   - Herramienta: Calendly / Google Calendar
   - Link:

→ Paso 5: Confirmar onboarding completo
   - Marcar como "activo" en el CRM

## Qué revisar si algo falla
1. Verificar que el email no fue a spam
2. Revisar logs de Zapier
3. Contactar a: [responsable]`,
    },
  ],
  "recursos-internos": [
    {
      label: "Recurso interno",
      content: `## Descripción
[Para qué sirve este recurso y cuándo usarlo]

## Links
- Principal:
- Backup / alternativo:

## Notas de uso
[Instrucciones o contexto importante]

## Última revisión
[Fecha y por quién]`,
    },
  ],
  "accesos": [
    {
      label: "Acceso a herramienta",
      content: `## Herramienta
[Nombre de la herramienta]

## URL de acceso
[URL]

## Credenciales
- Email/usuario: [especificar]
- Contraseña: Ver gestor de claves del equipo (NO guardar aquí)

## Permisos / plan
[Qué plan tenemos, qué features incluye]

## Quién tiene acceso
- [Persona 1]
- [Persona 2]

## Notas
[Contexto adicional, renovación, fecha de vencimiento, etc.]`,
    },
  ],
}

const MOCK_SEED: Omit<Item, "id" | "created_at" | "department_id">[] = [
  {
    title: "SOP Zapier — Automatizaciones internas",
    url: "#",
    description: "Qué automatizaciones existen, cómo funcionan y qué hacer si hay un error.",
    content: `## ¿Qué hace esta herramienta?
Zapier conecta automáticamente las herramientas del equipo de GovBidder y ejecuta tareas sin intervención manual.

## Automatizaciones existentes
- Zap 1: Nuevo lead en formulario → CRM (GovBidder)
- Zap 2: Pago confirmado → Email de bienvenida al cliente
- Zap 3: Reporte mensual enviado → Notificación en Slack

## Herramientas que conecta
→ Typeform → GovBidder CRM → Slack
→ Stripe → Email (Gmail) → CRM

## Cómo acceder
- URL: https://zapier.com
- Usuario: Ver gestor de claves del equipo
- Documentación: https://zapier.com/help

## Qué hacer si hay un error
1. Ir a Zapier → Task History y ver el error exacto
2. Verificar que los campos mapeados siguen existiendo en la fuente
3. Revisar si el token de conexión expiró (reconectar la app)
4. Si persiste: escalar a [responsable técnico]

## Dónde revisar cada automatización
- Panel de Zaps: https://zapier.com/app/zaps
- Task History: https://zapier.com/app/history`,
    category: "sop-sistemas",
    type: "doc",
  },
  {
    title: "SOP Onboarding — Alta de clientes",
    url: "#",
    description: "Proceso paso a paso para dar de alta un nuevo cliente.",
    content: `## Objetivo
Dar de alta a un nuevo cliente en todos los sistemas de GovBidder correctamente.

## Paso a paso

→ Paso 1: Crear perfil en el CRM
   - Ir a: govbidder.com/admin/clients
   - Completar: nombre, email, canal, programa, cuotas
   - Estado inicial: "activo"

→ Paso 2: Enviar accesos al cliente
   - Herramienta: Gmail
   - Template: [link al template de bienvenida]
   - Asegurarse de incluir: usuario, contraseña temporal, link al portal

→ Paso 3: Configurar automatizaciones en Zapier
   - Verificar que se dispare la Zap de nuevo cliente
   - Confirmar que el cliente aparece en el CRM

→ Paso 4: Agendar primera llamada de kickoff
   - Herramienta: Calendly
   - Enviar link de agendamiento al cliente

→ Paso 5: Confirmar onboarding completo
   - Checklist: perfil en CRM ✓, accesos enviados ✓, llamada agendada ✓

## Qué revisar si algo falla
1. Si el email no llegó: verificar spam o error en dirección
2. Si Zapier no se disparó: revisar Task History en Zapier
3. Escalar a: [responsable]`,
    category: "sop-operativos",
    type: "doc",
  },
  {
    title: "Plantillas internas de seguimiento",
    url: "#",
    description: "Plantillas del equipo para seguimiento semanal y reportes.",
    content: `## Descripción
Colección de plantillas que usa el equipo de GovBidder para el seguimiento interno de clientes y métricas.

## Links
- Plantilla semanal: [agregar link]
- Plantilla de reporte mensual: [agregar link]
- Plantilla de onboarding checklist: [agregar link]

## Notas de uso
Copiar la plantilla antes de usar. No editar el original.

## Última revisión
[Agregar fecha]`,
    category: "recursos-internos",
    type: "file",
  },
  {
    title: "Links importantes del equipo",
    url: "#",
    description: "Links frecuentes del equipo: Drive, Notion, herramientas.",
    content: `## Descripción
Colección de links que el equipo usa frecuentemente.

## Links
- Drive del equipo: [agregar link]
- Notion / base de conocimiento: [agregar link]
- Portal GovBidder: https://govbidder.com
- CRM interno: https://govbidder.com/admin/clients
- Zapier: https://zapier.com
- Panel de pagos: [agregar link]

## Notas de uso
Actualizar cuando se agreguen nuevas herramientas al stack.

## Última revisión
[Agregar fecha]`,
    category: "recursos-internos",
    type: "link",
  },
  {
    title: "Acceso Zapier",
    url: "https://zapier.com",
    description: "Acceso a la cuenta de Zapier del equipo GovBidder.",
    content: `## Herramienta
Zapier — plataforma de automatizaciones

## URL de acceso
https://zapier.com

## Credenciales
- Email/usuario: Ver gestor de claves del equipo
- Contraseña: Ver gestor de claves del equipo (NO guardar aquí)

## Permisos / plan
Plan Profesional — incluye Zaps ilimitadas y acceso multi-usuario

## Quién tiene acceso
- [Agregar personas con acceso]

## Notas
Renovación anual. Verificar fecha de vencimiento en la cuenta.`,
    category: "accesos",
    type: "link",
  },
]

// ─── Content Renderer ─────────────────────────────────────────────────────────

function ContentRenderer({ content }: { content: string }) {
  const lines = content.split("\n")

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="text-sm font-semibold text-foreground mt-5 mb-2 first:mt-0">
              {line.replace("## ", "")}
            </h3>
          )
        }
        if (line.startsWith("→ ")) {
          return (
            <div key={i} className="flex items-start gap-2 py-1">
              <ArrowRight className="h-3.5 w-3.5 text-[#E42D2C] flex-shrink-0 mt-0.5" />
              <span className="text-sm text-muted-foreground font-medium">{line.replace("→ ", "")}</span>
            </div>
          )
        }
        if (line.match(/^- /)) {
          return (
            <div key={i} className="flex items-start gap-2 pl-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white/20 flex-shrink-0 mt-2" />
              <span className="text-xs text-muted-foreground leading-relaxed">{line.replace(/^- /, "")}</span>
            </div>
          )
        }
        if (line.match(/^\d+\. /)) {
          const num = line.match(/^(\d+)\. /)?.[1]
          return (
            <div key={i} className="flex items-start gap-2.5 pl-2 py-0.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E42D2C]/15 text-[10px] font-bold text-[#E42D2C] flex-shrink-0 mt-0.5">
                {num}
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">{line.replace(/^\d+\. /, "")}</span>
            </div>
          )
        }
        if (line.trim() === "") return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-xs text-muted-foreground leading-relaxed pl-2">{line}</p>
        )
      })}
    </div>
  )
}

// ─── SOP Modal ────────────────────────────────────────────────────────────────

function SOPModal({
  item,
  sectionId,
  canEdit,
  onClose,
  onUpdate,
  onDelete,
}: {
  item: Item
  sectionId: SectionId
  canEdit: boolean
  onClose: () => void
  onUpdate: (updated: Item) => void
  onDelete: (id: string) => void
}) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.link
  const Icon = cfg.icon
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(item.content ?? "")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isAccesos = sectionId === "accesos"
  const templates = TEMPLATES[sectionId] ?? []

  const date = new Date(item.created_at).toLocaleDateString("es-AR", {
    day: "2-digit", month: "long", year: "numeric",
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, content }),
      })
      const data = await res.json()
      if (res.ok) {
        onUpdate({ ...item, content })
        setEditing(false)
      } else {
        alert(data.error || "Error al guardar")
      }
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${item.title}"?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/resources?id=${item.id}`, { method: "DELETE" })
      onDelete(item.id)
      onClose()
    } finally { setDeleting(false) }
  }

  const applyTemplate = (tmpl: { content: string }) => {
    setContent(tmpl.content)
    setEditing(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-slate-900/30"
        onClick={onClose}
      />

      {/* Panel container */}
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-border flex-shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted flex-shrink-0">
            <Icon className={`h-5 w-5 ${cfg.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground leading-snug">{item.title}</h2>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${cfg.color}`}>
                {cfg.label}
              </span>
              <span className="text-[10px] text-muted-foreground/70">{date}</span>
              {item.url && item.url !== "#" && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-medium text-[#E42D2C]/60 hover:text-[#E42D2C] transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir link
                </a>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-muted-foreground hover:text-muted-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Security warning for accesos */}
        {isAccesos && (
          <div className="flex items-start gap-2.5 mx-5 mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 flex-shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700/70 leading-relaxed">
              <span className="font-semibold text-amber-700">No guardes contraseñas aquí.</span>{" "}
              Solo referencias (email, usuario). Las credenciales deben estar en el gestor de claves del equipo.
            </p>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Templates — only when no content (y solo si el user puede editar) */}
          {canEdit && !content && !editing && templates.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Comenzar con un template
              </p>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => applyTemplate(t)}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  >
                    <Copy className="h-3 w-3" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content area */}
          {editing ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              autoFocus
              rows={20}
              placeholder={`Escribí el contenido del SOP...\n\nUsá:\n## Título de sección\n→ Paso con flecha\n- Ítem de lista\n1. Paso numerado`}
              className="w-full rounded-xl bg-muted border border-[#E42D2C]/20 px-4 py-3 text-sm text-muted-foreground placeholder-white/20 focus:outline-none focus:border-[#E42D2C]/40 resize-none leading-relaxed font-mono"
            />
          ) : content ? (
            <ContentRenderer content={content} />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <FileText className="h-8 w-8 text-muted-foreground/70" />
              <p className="text-xs text-muted-foreground/70 text-center">
                Este SOP todavía no tiene contenido.<br />
                Usá un template o escribí desde cero.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-400/5 border border-transparent hover:border-red-400/10 transition-all"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Eliminar
              </button>
            )}
            {content && !editing && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-muted-foreground border border-transparent hover:border-border transition-all"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            )}
            {!canEdit && (
              <span
                className="text-[10px] text-muted-foreground/70 italic"
                title="Este SOP pertenece a otra área. Solo admins o miembros del mismo depto pueden editar."
              >
                Solo lectura
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => { setContent(item.content ?? ""); setEditing(false) }}
                  className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-[#E42D2C] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#E42D2C]/90 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Guardar
                </button>
              </>
            ) : canEdit ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-xl bg-muted px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors border border-border"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
            ) : null}
          </div>
        </div>
        </div>
      </div>
    </Portal>
  )
}

// ─── Add Item Form ─────────────────────────────────────────────────────────────
//
// El form de creación cambia según la sección:
//  - SOPs (sop-sistemas, sop-operativos): un SOP es un documento interno. El form
//    pide solo título + descripción y un template opcional. No tiene URL ni tipo
//    de archivo (siempre es type="doc").
//  - Recursos/Accesos: ítems con link externo. Form clásico con URL + tipo.

function AddItemForm({
  sectionId,
  departments,
  callerRole,
  callerDeptId,
  defaultDeptId,
  onAdd,
  onClose,
}: {
  sectionId:     SectionId
  departments:   Department[]
  callerRole:    Role | null
  callerDeptId:  string | null
  defaultDeptId: string | null
  onAdd:         (item: Item) => void
  onClose:       () => void
}) {
  const isSOP = sectionId === "sop-sistemas" || sectionId === "sop-operativos"
  return isSOP
    ? <AddSOPForm
        sectionId={sectionId}
        departments={departments}
        callerRole={callerRole}
        callerDeptId={callerDeptId}
        defaultDeptId={defaultDeptId}
        onAdd={onAdd}
        onClose={onClose}
      />
    : <AddResourceForm sectionId={sectionId} onAdd={onAdd} onClose={onClose} />
}

function AddSOPForm({
  sectionId,
  departments,
  callerRole,
  callerDeptId,
  defaultDeptId,
  onAdd,
  onClose,
}: {
  sectionId:     SectionId
  departments:   Department[]
  callerRole:    Role | null
  callerDeptId:  string | null
  defaultDeptId: string | null
  onAdd:         (item: Item) => void
  onClose:       () => void
}) {
  // Si el caller NO es admin+, solo puede elegir SU propio departamento.
  // No mostramos "Sin asignar" ni los otros deptos en el chip selector.
  const isAdmin = isAdminOrAbove(callerRole)
  const restrictedDeptId = !isAdmin ? callerDeptId : null
  // Inicial: si es user normal, forzamos su depto; si es admin, lo que vino.
  const initialDeptId = restrictedDeptId ?? defaultDeptId
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [deptId, setDeptId] = useState<string | null>(initialDeptId)
  const [templateIdx, setTemplateIdx] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const templates = TEMPLATES[sectionId] ?? []
  // user normal sin depto no debería poder llegar acá (el padre oculta el botón),
  // pero defensivamente lo marcamos.
  const cannotChooseDept = !isAdmin
  const lockedDept = cannotChooseDept ? departments.find(d => d.id === restrictedDeptId) ?? null : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError("El título es requerido"); return }
    setLoading(true); setError("")
    try {
      const content = templateIdx !== null ? templates[templateIdx]?.content ?? null : null
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:         title.trim(),
          description:   description.trim(),
          url:           "",
          type:          "doc",
          content,
          category:      sectionId,
          department_id: deptId,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Error al guardar"); return }
      onAdd(data.resource)
      onClose()
    } catch { setError("Error de conexión") }
    finally { setLoading(false) }
  }

  return (
    <div className="rounded-2xl border border-[#E42D2C]/20 bg-card p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Nuevo SOP</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
            Título del SOP <span className="text-[#E42D2C]">*</span>
          </label>
          <input
            type="text"
            placeholder='Ej. "SOP de onboarding de clientes"'
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
            className="w-full rounded-xl bg-muted border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-[#E42D2C]/40"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
            Descripción <span className="text-muted-foreground/60">(opcional)</span>
          </label>
          <textarea
            placeholder="Resumen corto del proceso: qué resuelve, cuándo se usa."
            value={description}
            rows={2}
            onChange={e => setDescription(e.target.value)}
            className="w-full rounded-xl bg-muted border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-[#E42D2C]/40 resize-none"
          />
        </div>

        {departments.length > 0 && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Área {!cannotChooseDept && <span className="text-muted-foreground/60">(opcional)</span>}
            </label>
            {cannotChooseDept ? (
              // user normal: depto locked al suyo, sin opciones para elegir.
              lockedDept ? (
                <div className="flex items-center gap-2">
                  <span
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                    style={{ borderColor: lockedDept.color, backgroundColor: `${lockedDept.color}1f`, color: lockedDept.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: lockedDept.color }} />
                    {lockedDept.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 italic">
                    Tu área (no editable)
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-amber-700/80">
                  Tu cuenta no tiene departamento asignado. Pedile a un admin que te asigne uno.
                </p>
              )
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDeptId(null)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    deptId === null
                      ? "border-[#E42D2C]/40 bg-[#E42D2C]/10 text-[#E42D2C]"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  Sin asignar
                </button>
                {departments.map(d => {
                  const active = deptId === d.id
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDeptId(d.id)}
                      style={active ? { borderColor: d.color, backgroundColor: `${d.color}1f`, color: d.color } : undefined}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                        !active && "border-border bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {templates.length > 0 && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Empezar con template <span className="text-muted-foreground/60">(opcional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTemplateIdx(null)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all",
                  templateIdx === null
                    ? "border-[#E42D2C]/40 bg-[#E42D2C]/10 text-[#E42D2C]"
                    : "border-border bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                En blanco
              </button>
              {templates.map((t, i) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setTemplateIdx(i)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all",
                    templateIdx === i
                      ? "border-[#E42D2C]/40 bg-[#E42D2C]/10 text-[#E42D2C]"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Copy className="h-3 w-3" />
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1.5 leading-relaxed">
              Te creamos el SOP con la estructura básica para que vayas completando los campos.
            </p>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[#E42D2C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E42D2C]/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Crear SOP
          </button>
        </div>
      </form>
    </div>
  )
}

function AddResourceForm({
  sectionId,
  onAdd,
  onClose,
}: {
  sectionId: SectionId
  onAdd: (item: Item) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    title: "",
    url: "",
    description: "",
    type: "link" as ResourceType,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const isAccesos = sectionId === "accesos"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError("El título es requerido"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, category: sectionId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Error al guardar"); return }
      onAdd(data.resource)
      onClose()
    } catch { setError("Error de conexión") }
    finally { setLoading(false) }
  }

  return (
    <div className="rounded-2xl border border-[#E42D2C]/20 bg-card p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          {isAccesos ? "Nuevo acceso" : "Nuevo recurso"}
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {isAccesos && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 mb-4">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700/80 leading-relaxed">
            <span className="font-semibold text-amber-700">No guardes contraseñas en texto plano.</span>{" "}
            Solo referencias (email, usuario, dónde encontrar las credenciales).
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Título *"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          autoFocus
          className="w-full rounded-xl bg-muted border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-[#E42D2C]/40"
        />
        <input
          type="text"
          placeholder={isAccesos ? "URL de la herramienta (opcional)" : "URL (opcional)"}
          value={form.url}
          onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          className="w-full rounded-xl bg-muted border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-[#E42D2C]/40"
        />
        <textarea
          placeholder="Descripción breve (opcional)"
          value={form.description}
          rows={2}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          className="w-full rounded-xl bg-muted border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-[#E42D2C]/40 resize-none"
        />
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(TYPE_CONFIG) as ResourceType[]).map(t => {
            const cfg = TYPE_CONFIG[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                  form.type === t
                    ? "border-[#E42D2C]/40 bg-[#E42D2C]/10 text-[#E42D2C]"
                    : "border-border bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <cfg.icon className="h-3 w-3" />
                {cfg.label}
              </button>
            )
          })}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[#E42D2C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E42D2C]/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Crear
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Item Row ──────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  department,
  onClick,
}: {
  item: Item
  department?: Department
  onClick: () => void
}) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.link
  const Icon = cfg.icon
  const hasContent = !!item.content

  return (
    <button
      onClick={onClick}
      className="w-full group flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 hover:border-border hover:bg-muted transition-all text-left"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted flex-shrink-0">
        <Icon className={`h-4 w-4 ${cfg.color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {department && (
          <span
            className="flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5"
            style={{ backgroundColor: `${department.color}1f`, color: department.color }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: department.color }} />
            {department.name}
          </span>
        )}
        {hasContent && (
          <span className="text-[10px] font-semibold text-green-400/60 bg-green-400/10 rounded-full px-2 py-0.5">
            Documentado
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground/70 group-hover:text-muted-foreground transition-colors" />
      </div>
    </button>
  )
}

// ─── Department Chip ──────────────────────────────────────────────────────────

function DeptChip({
  label,
  count,
  color,
  active,
  dimmed,
  onClick,
}: {
  label:   string
  count:   number
  color?:  string
  active:  boolean
  dimmed?: boolean
  onClick: () => void
}) {
  const baseStyles = active
    ? color
      ? { borderColor: color, backgroundColor: `${color}1f`, color }
      : undefined
    : undefined
  return (
    <button
      type="button"
      onClick={onClick}
      style={baseStyles}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
        active
          ? color
            ? ""
            : "border-[#E42D2C]/40 bg-[#E42D2C]/10 text-[#E42D2C]"
          : dimmed
            ? "border-border bg-muted text-muted-foreground/70 hover:text-foreground"
            : "border-border bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {color && !active && (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
      <span className={cn(
        "text-[10px] rounded-full px-1.5 py-0.5",
        active ? "bg-foreground/10" : "bg-muted-foreground/10",
      )}>
        {count}
      </span>
    </button>
  )
}

// ─── Section Panel ─────────────────────────────────────────────────────────────

function SectionPanel({
  section,
  items,
  departments,
  callerRole,
  callerDeptId,
  onAdd,
  onUpdate,
  onDelete,
}: {
  section: (typeof SECTIONS)[number]
  items: Item[]
  departments: Department[]
  callerRole: Role | null
  callerDeptId: string | null
  onAdd: (item: Item) => void
  onUpdate: (item: Item) => void
  onDelete: (id: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")
  const [activeItem, setActiveItem] = useState<Item | null>(null)
  // Filtro de departamento (solo en SOPs). `null` = todos. `NO_DEPT_ID` = sin asignar.
  const [activeDeptFilter, setActiveDeptFilter] = useState<string | null>(null)
  const Icon = section.icon
  const isAccesos = section.id === "accesos"
  const isSOP = section.id === "sop-sistemas" || section.id === "sop-operativos"
  const addLabel = isSOP ? "Nuevo SOP" : isAccesos ? "Nuevo acceso" : "Nuevo recurso"

  // Permisos:
  // - viewer no puede crear nada.
  // - user-normal en sección SOP sin departamento asignado → no puede crear.
  // - resto puede crear (admin+ siempre, user-normal en non-SOP también).
  const isViewer = callerRole === "viewer"
  const canCreate = !isViewer && (
    !isSOP || isAdminOrAbove(callerRole) || !!callerDeptId
  )

  // Mapa para lookups rápidos de un depto por id (pill en row, header de grupo).
  const deptById = new Map(departments.map(d => [d.id, d]))

  // Filtro de búsqueda + depto (este último solo cuando es sección SOP).
  const searchFiltered = items.filter(
    i =>
      search === "" ||
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.description?.toLowerCase().includes(search.toLowerCase()),
  )
  const filtered = isSOP && activeDeptFilter !== null
    ? searchFiltered.filter(i =>
        activeDeptFilter === NO_DEPT_ID ? !i.department_id : i.department_id === activeDeptFilter,
      )
    : searchFiltered

  // Conteos por depto para los chips (sobre `items`, no `filtered`).
  const countByDept = new Map<string, number>()
  let noDeptCount = 0
  for (const it of items) {
    if (!it.department_id) noDeptCount++
    else countByDept.set(it.department_id, (countByDept.get(it.department_id) ?? 0) + 1)
  }

  // Cuando filter activo + "Todos" → mostrar agrupado por depto. Cuando hay
  // filtro específico, lista plana (ya está acotada al depto). Cuando NO es
  // SOP, siempre lista plana.
  const showGrouped = isSOP && activeDeptFilter === null && search === "" && filtered.length > 0
  const grouped = (() => {
    if (!showGrouped) return null
    const buckets = new Map<string, Item[]>()
    for (const it of filtered) {
      const key = it.department_id ?? NO_DEPT_ID
      const list = buckets.get(key) ?? []
      list.push(it)
      buckets.set(key, list)
    }
    // Orden: departamentos por sort_order, "Sin asignar" al final.
    const ordered: { id: string; label: string; color?: string; items: Item[] }[] = []
    for (const d of departments) {
      const list = buckets.get(d.id)
      if (list?.length) ordered.push({ id: d.id, label: d.name, color: d.color, items: list })
    }
    const noDept = buckets.get(NO_DEPT_ID)
    if (noDept?.length) ordered.push({ id: NO_DEPT_ID, label: "Sin asignar", items: noDept })
    return ordered
  })()

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className={`flex items-start gap-3 rounded-2xl border p-4 ${section.accent}`}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted flex-shrink-0">
          <Icon className={`h-5 w-5 ${section.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{section.label}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{section.desc}</p>
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground/70 bg-muted rounded-full px-2.5 py-1 flex-shrink-0">
          {items.length}
        </span>
      </div>

      {isAccesos && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700/70 leading-relaxed">
            <span className="font-semibold text-amber-700">Aviso de seguridad:</span>{" "}
            Guardá solo referencias (email, usuario, dónde están las credenciales). Las contraseñas deben
            vivir en el gestor de claves del equipo.
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl bg-muted border border-border pl-9 pr-4 py-2 text-sm text-foreground placeholder-white/30 focus:outline-none focus:border-[#E42D2C]/40"
          />
        </div>
        {canCreate ? (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-[#E42D2C] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#E42D2C]/90 transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </button>
        ) : isSOP && !isAdminOrAbove(callerRole) && !callerDeptId && !isViewer ? (
          <span
            className="text-[10px] text-muted-foreground/70 italic whitespace-nowrap max-w-[200px]"
            title="Tu cuenta no tiene departamento asignado. Pedile a un admin que te asigne uno para crear SOPs."
          >
            Asigná tu depto para crear SOPs
          </span>
        ) : null}
      </div>

      {/* Department filter chips — solo en SOPs */}
      {isSOP && (departments.length > 0 || noDeptCount > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 pr-1">
            Área
          </span>
          <DeptChip
            label="Todas"
            active={activeDeptFilter === null}
            count={items.length}
            onClick={() => setActiveDeptFilter(null)}
          />
          {departments.map(d => {
            const c = countByDept.get(d.id) ?? 0
            if (c === 0) return null
            return (
              <DeptChip
                key={d.id}
                label={d.name}
                color={d.color}
                active={activeDeptFilter === d.id}
                count={c}
                onClick={() => setActiveDeptFilter(d.id)}
              />
            )
          })}
          {noDeptCount > 0 && (
            <DeptChip
              label="Sin asignar"
              active={activeDeptFilter === NO_DEPT_ID}
              count={noDeptCount}
              onClick={() => setActiveDeptFilter(NO_DEPT_ID)}
              dimmed
            />
          )}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <AddItemForm
          sectionId={section.id}
          departments={departments}
          callerRole={callerRole}
          callerDeptId={callerDeptId}
          defaultDeptId={
            isSOP && activeDeptFilter !== null && activeDeptFilter !== NO_DEPT_ID
              ? activeDeptFilter
              : !isAdminOrAbove(callerRole) && isSOP
                ? callerDeptId  // user-normal en SOP: arranca con su propio depto.
                : null
          }
          onAdd={item => { onAdd(item); setShowForm(false) }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Items list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3">
          <FolderOpen className="h-8 w-8 text-muted-foreground/70" />
          <p className="text-xs text-muted-foreground/70">
            {search
              ? "Sin resultados"
              : isSOP && activeDeptFilter !== null
                ? "No hay SOPs en esta área todavía"
                : "Todavía no hay ítems en esta sección"}
          </p>
          {!showForm && !search && (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs text-[#E42D2C]/70 hover:text-[#E42D2C] transition-colors"
            >
              + {isSOP ? "Crear el primer SOP" : "Agregar el primero"}
            </button>
          )}
        </div>
      ) : grouped ? (
        <div className="space-y-6">
          {grouped.map(g => (
            <div key={g.id} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                {g.color && (
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                )}
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {g.label}
                </h3>
                <span className="text-[10px] text-muted-foreground/70">· {g.items.length}</span>
              </div>
              <div className="space-y-2">
                {g.items.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    department={item.department_id ? deptById.get(item.department_id) : undefined}
                    onClick={() => setActiveItem(item)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              department={item.department_id ? deptById.get(item.department_id) : undefined}
              onClick={() => setActiveItem(item)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {activeItem && (
        <SOPModal
          item={activeItem}
          sectionId={section.id}
          canEdit={canModifyResource(callerRole, callerDeptId, {
            category:      activeItem.category,
            department_id: activeItem.department_id,
          })}
          onClose={() => setActiveItem(null)}
          onUpdate={updated => {
            onUpdate(updated)
            setActiveItem(updated)
          }}
          onDelete={id => {
            onDelete(id)
            setActiveItem(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export function AdminCentroOperativoView() {
  const [items, setItems] = useState<Item[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<SectionId>("sop-sistemas")
  // Role + depto del user actual — gobierna qué acciones puede ejecutar.
  const [callerRole, setCallerRole]     = useState<Role | null>(null)
  const [callerDeptId, setCallerDeptId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Fetch del profile del user para tener role + department_id en client.
    const profilePromise = supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user?.id
      if (!userId) return { role: null as Role | null, department_id: null as string | null }
      const { data: profile } = await supabase
        .from("profiles").select("role, department_id").eq("id", userId).single()
      return {
        role:          (profile?.role as Role | undefined) ?? null,
        department_id: (profile?.department_id as string | null | undefined) ?? null,
      }
    }).catch(() => ({ role: null as Role | null, department_id: null as string | null }))

    Promise.all([
      fetch("/api/resources").then(r => r.json()).catch(() => ({ resources: [] })),
      fetch("/api/departments").then(r => r.json()).catch(() => ({ departments: [] })),
      profilePromise,
    ])
      .then(([resData, deptData, profile]) => {
        const fetched: Item[] = (resData.resources ?? []).map((r: any) => ({
          ...r,
          department_id: r.department_id ?? null,
        }))
        const opCats: string[] = SECTIONS.map(s => s.id)
        const existing = fetched.filter(i => opCats.includes(i.category))
        if (existing.length === 0) {
          const seeded = MOCK_SEED.map((s, idx) => ({
            ...s,
            id: `mock-${idx}`,
            department_id: null,
            created_at: new Date().toISOString(),
          }))
          setItems([...fetched.filter(i => !opCats.includes(i.category)), ...seeded])
        } else {
          setItems(fetched)
        }
        setDepartments(deptData.departments ?? [])
        setCallerRole(profile.role)
        setCallerDeptId(profile.department_id)
      })
      .finally(() => setLoading(false))
  }, [])

  const section = SECTIONS.find(s => s.id === activeSection)!
  const sectionItems = items.filter(i => i.category === activeSection)

  const handleAdd    = (item: Item)   => setItems(prev => [item, ...prev])
  const handleUpdate = (item: Item)   => setItems(prev => prev.map(i => i.id === item.id ? item : i))
  const handleDelete = (id: string)   => setItems(prev => prev.filter(i => i.id !== id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#1e3a8a]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Centro Operativo</h1>
        </div>
        <p className="text-xs text-muted-foreground ml-[18px]">
          Base interna de SOPs, recursos, accesos y procesos del equipo GovBidder.
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap">
        {SECTIONS.map(s => {
          const Icon = s.icon
          const count = items.filter(i => i.category === s.id).length
          const isActive = activeSection === s.id
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium border transition-all",
                isActive
                  ? "border-[#E42D2C]/30 bg-[#E42D2C]/10 text-[#E42D2C]"
                  : "border-border bg-muted text-muted-foreground hover:text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-[#E42D2C]" : s.color}`} />
              {s.label}
              <span className={cn(
                "text-[10px] rounded-full px-1.5 py-0.5",
                isActive ? "bg-[#E42D2C]/20 text-[#E42D2C]" : "bg-muted text-muted-foreground",
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active section */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
        </div>
      ) : (
        <SectionPanel
          section={section}
          items={sectionItems}
          departments={departments}
          callerRole={callerRole}
          callerDeptId={callerDeptId}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
