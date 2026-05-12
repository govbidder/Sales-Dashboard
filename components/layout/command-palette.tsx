"use client"

/**
 * Command Palette — Linear-grade.
 *
 * Filosofía:
 *   - Cmd+K es la columna vertebral de uso. TODO lo importante se
 *     puede disparar desde acá sin tocar el mouse.
 *   - Acciones agrupadas por intención: Recientes · Navegación ·
 *     Departamentos · Crear · Tema · Vista As · Cuenta · Tareas ·
 *     Personas.
 *   - Fuzzy search sobre todo. Las dinámicas (tasks/personas/deptos)
 *     se lazy-loadean al abrir.
 *   - Acciones con feedback (toast) o navegación SPA.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useTheme } from "@/components/ui/theme-provider"
import { useViewAs } from "@/lib/contexts/view-as-context"
import { useToast } from "@/components/ui/toast"
import {
  Search, ArrowRight, Command, BarChart3, LayoutGrid,
  FileBarChart, Users2, ListTodo, Users, Layers, Wrench, BookOpen,
  CalendarDays, Plus, LogOut, Activity, User as UserIcon, CheckSquare,
  Sun, Moon, Monitor, Eye, EyeOff, Folder, Rss, Shield, LayoutTemplate,
  FormInput, Settings, Clock, Sparkles,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemKind = "page" | "action"

interface Item {
  id:       string
  kind:     ItemKind
  title:    string
  subtitle?: string
  /** Keyboard hint (ej. "G I" o "⌘⇧C"). Visual cue, no triggerea. */
  hint?:    string
  /** Color del icono activo. Cuando el palette ranquea bajo es muted. */
  icon:     any
  /** Color custom del icono (ej. color del depto). */
  iconColor?: string
  href?:    string
  group:    string
  keywords?: string[]
  action?:  () => void | Promise<void>
}

const RECENT_KEY = "govbidder_palette_recents"
const RECENT_MAX = 5

// ─── Static pages registry ────────────────────────────────────────────────────

const PAGES: Item[] = [
  // Inicio
  { id: "p:inicio",    kind: "page", title: "Página Principal", subtitle: "Estado del dashboard", icon: Activity,     href: "/inicio",    hint: "G I", group: "Navegación", keywords: ["home","inicio","hoy","health"] },

  // Métricas / Performance
  { id: "p:metrics",   kind: "page", title: "Métricas",        subtitle: "KPIs · Conversión · Cargar", icon: LayoutGrid, href: "/metrics", hint: "G M", group: "Navegación", keywords: ["dashboard","kpis","ventas","metrics","numbers"] },
  { id: "p:dashboard", kind: "page", title: "Panel (legacy)",  subtitle: "Vista clásica de KPIs",    icon: BarChart3,  href: "/dashboard",                  group: "Navegación", keywords: ["panel","kpi","resumen"] },
  { id: "p:revenue",   kind: "page", title: "Ventas (legacy)", subtitle: "Embudo de conversión",     icon: BarChart3,  href: "/sales",  hint: "G S",      group: "Navegación", keywords: ["sales","ventas","funnel"] },

  // Operación
  { id: "p:personas",  kind: "page", title: "Personas Agendadas", subtitle: "Pipeline de prospectos", icon: Users2,    href: "/admin/personas",         hint: "G A", group: "Navegación", keywords: ["leads","prospectos","calls"] },
  { id: "p:tasks",     kind: "page", title: "Tareas",             subtitle: "Kanban · Lista · Calendario", icon: ListTodo, href: "/admin/tasks",         hint: "G T", group: "Navegación", keywords: ["todo","kanban","trabajo"] },
  { id: "p:schedule",  kind: "page", title: "Agenda",             subtitle: "Calendario del equipo",  icon: CalendarDays, href: "/calendar",                 group: "Navegación", keywords: ["schedule","calendario","calendar"] },
  { id: "p:activity",  kind: "page", title: "Actividad",          subtitle: "Feed de cambios",        icon: Rss,         href: "/admin/activity",            group: "Navegación", keywords: ["feed","activity","log"] },

  // Equipo
  { id: "p:team",      kind: "page", title: "Miembros",           subtitle: "Gente del equipo",       icon: Users,       href: "/admin/team",       hint: "G E", group: "Navegación", keywords: ["staff","gente","empleados","team"] },
  { id: "p:depts",     kind: "page", title: "Departamentos",      subtitle: "Áreas + grid",           icon: Layers,      href: "/admin/departments",                    group: "Navegación", keywords: ["deptos","areas","grupos"] },

  // Admin / Programa
  { id: "p:reports",   kind: "page", title: "Cargar Reporte",     subtitle: "Form mensual",           icon: FileBarChart, href: "/admin/reports",  hint: "G R", group: "Navegación", keywords: ["input","form","mes","cargar"] },
  { id: "p:templates", kind: "page", title: "Templates de tareas", subtitle: "Plantillas reusables",   icon: LayoutTemplate, href: "/admin/task-templates",            group: "Navegación", keywords: ["templates","plantillas"] },
  { id: "p:forms",     kind: "page", title: "Forms públicos",     subtitle: "Formularios y submissions", icon: FormInput, href: "/admin/forms",                       group: "Navegación", keywords: ["forms","formularios"] },
  { id: "p:ops",       kind: "page", title: "Centro Operativo",   subtitle: "Procesos · SOPs",        icon: Settings,    href: "/admin/centro-operativo", hint: "G O", group: "Navegación", keywords: ["sop","wiki","procedimientos"] },
  { id: "p:audit",     kind: "page", title: "Auditoría",          subtitle: "Log de acciones",        icon: Shield,      href: "/admin/audit-log",                       group: "Navegación", keywords: ["audit","log","impersonation"] },
  { id: "p:tools",     kind: "page", title: "Herramientas",       subtitle: "Tools internos",         icon: Wrench,      href: "/tools",                                 group: "Navegación", keywords: ["tools","links","apps"] },
  { id: "p:resources", kind: "page", title: "Recursos",           subtitle: "Biblioteca interna",     icon: BookOpen,    href: "/recursos",                              group: "Navegación", keywords: ["resources","biblioteca","docs"] },
  { id: "p:crm",       kind: "page", title: "CRM",                subtitle: "Módulo nuevo · Beta",    icon: Sparkles,    href: "/crm",  hint: "⌘⇧C",                     group: "Navegación", keywords: ["crm","clientes","portal","narnia"] },
]

// ─── Fuzzy match ──────────────────────────────────────────────────────────────

function score(item: Item, query: string): number {
  if (!query) return 0
  const q = query.toLowerCase().trim()
  if (!q) return 0

  const title    = item.title.toLowerCase()
  const subtitle = (item.subtitle ?? "").toLowerCase()
  const kws      = (item.keywords ?? []).join(" ").toLowerCase()
  const haystack = `${title} ${subtitle} ${kws}`

  if (title.startsWith(q))  return 100 + (q.length / title.length) * 50
  if (title.includes(q))    return 70  + (q.length / title.length) * 20
  if (subtitle.includes(q)) return 40
  if (kws.includes(q))      return 30
  let i = 0, j = 0, hits = 0
  while (i < haystack.length && j < q.length) {
    if (haystack[i] === q[j]) { hits++; j++ }
    i++
  }
  if (hits === q.length) return 10 + hits
  return 0
}

// ─── Recents helpers ─────────────────────────────────────────────────────────

function getRecents(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_MAX) : []
  } catch { return [] }
}

function pushRecent(id: string) {
  if (typeof window === "undefined") return
  try {
    const cur = getRecents().filter(x => x !== id)
    cur.unshift(id)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, RECENT_MAX)))
  } catch { /* silent */ }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open:    boolean
  onClose: () => void
  onSignOut?: () => void
}

export function CommandPalette({ open, onClose, onSignOut }: CommandPaletteProps) {
  const router    = useRouter()
  const pathname  = usePathname()
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const {
    viewAsUser, viewAsRole, viewAsDepartmentId,
    members, departments: viewAsDepts, setViewAsUser, clearViewAs, isViewing,
  } = useViewAs()
  const toast = useToast()

  const [query, setQuery]         = useState("")
  const [activeIdx, setActiveIdx] = useState(0)
  const [dataItems, setDataItems] = useState<Item[]>([])
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; color: string }>>([])
  const [recents, setRecents] = useState<string[]>([])

  // ─── Lazy-load: personas + tasks + departments ───────────────────────────
  useEffect(() => {
    if (!open) return
    setRecents(getRecents())
    if (dataItems.length > 0 && departments.length > 0) return
    let aborted = false

    async function load() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const headers = { Authorization: `Bearer ${session.access_token}` }
        const [personasRes, tasksRes, deptsRes] = await Promise.all([
          fetch("/api/admin/personas",                    { headers }),
          fetch("/api/admin/tasks?include_subtasks=true", { headers }),
          fetch("/api/departments",                       { headers }),
        ])
        const personas = personasRes.ok ? (await personasRes.json()).personas ?? [] : []
        const tasks    = tasksRes.ok    ? (await tasksRes.json()).tasks ?? []     : []
        const depts    = deptsRes.ok    ? (await deptsRes.json()).departments ?? [] : []
        if (aborted) return

        setDepartments(depts)
        setDataItems([
          ...personas.map((p: any) => ({
            id:       `data:persona:${p.id}`,
            kind:     "page" as const,
            title:    p.name,
            subtitle: [p.email, p.phone].filter(Boolean).join(" · ") || "Persona agendada",
            icon:     UserIcon,
            href:     "/admin/personas",
            group:    "Personas",
            keywords: [p.email, p.phone, p.owner].filter(Boolean) as string[],
          })),
          ...tasks.map((t: any) => ({
            id:       `data:task:${t.id}`,
            kind:     "page" as const,
            title:    t.title,
            subtitle: t.description?.slice(0, 60) ?? `Tarea · ${t.status}`,
            icon:     CheckSquare,
            href:     "/admin/tasks",
            group:    "Tareas",
            keywords: (t.tags ?? []).concat(t.assignees ?? []) as string[],
          })),
        ])
      } catch { /* silent */ }
    }
    load()
    return () => { aborted = true }
  }, [open, dataItems.length, departments.length])

  // ─── Trigger ─────────────────────────────────────────────────────────────
  const trigger = useCallback((item: Item) => {
    if (item.id.startsWith("p:")) pushRecent(item.id)
    if (item.action) {
      const result = item.action()
      if (result && typeof result === "object" && "then" in result) {
        (result as Promise<void>).catch(() => { /* silenced */ })
      }
    } else if (item.href) {
      router.push(item.href)
    }
    onClose()
  }, [router, onClose])

  // ─── Build full item list ───────────────────────────────────────────────
  const allItems: Item[] = useMemo(() => {
    const items: Item[] = [...PAGES]

    // Departments → "Ir a [Nombre]" + "Kanban de [Nombre]"
    for (const d of departments) {
      items.push({
        id:        `d:dash:${d.id}`,
        kind:      "page",
        title:     `Ir a ${d.name}`,
        subtitle:  "Dashboard del departamento",
        icon:      Folder,
        iconColor: d.color,
        href:      `/admin/departments/${d.id}`,
        group:     "Departamentos",
        keywords:  ["dept","depto","departamento", d.name.toLowerCase()],
      })
      items.push({
        id:        `d:kanban:${d.id}`,
        kind:      "page",
        title:     `Kanban de ${d.name}`,
        subtitle:  "Tareas filtradas al depto",
        icon:      ListTodo,
        iconColor: d.color,
        href:      `/admin/tasks?department=${d.id}`,
        group:     "Departamentos",
        keywords:  ["kanban","tasks","tareas", d.name.toLowerCase()],
      })
    }

    // Crear (acciones)
    items.push(
      { id: "a:new-task",     kind: "action", title: "Nueva tarea",            subtitle: "Crear y asignar", icon: Plus, href: "/admin/tasks?new=1",     hint: "N",    group: "Crear", keywords: ["task","todo","crear"] },
      { id: "a:new-persona",  kind: "action", title: "Nueva persona agendada", subtitle: "Sumar al pipeline", icon: Plus, href: "/admin/personas?new=1",  hint: "P",    group: "Crear", keywords: ["lead","crear","persona"] },
      { id: "a:invite-member",kind: "action", title: "Invitar miembro al equipo", subtitle: "Generar link de invite",   icon: Users, href: "/admin/team?invite=1",                            group: "Crear", keywords: ["nuevo","miembro","email"] },
      { id: "a:new-template", kind: "action", title: "Nuevo template de tarea",   subtitle: "Plantilla reusable",        icon: LayoutTemplate, href: "/admin/task-templates?new=1",            group: "Crear", keywords: ["template","plantilla","crear"] },
      { id: "a:new-form",     kind: "action", title: "Nuevo formulario público",  subtitle: "Form de captación",         icon: FormInput,      href: "/admin/forms?new=1",                     group: "Crear", keywords: ["form","public","captacion"] },
      { id: "a:load-metrics", kind: "action", title: "Cargar métricas del mes",   subtitle: "Form mensual de KPIs",      icon: FileBarChart,   href: "/admin/reports",                         group: "Crear", keywords: ["mes","reportes","kpi"] },
    )

    // Tema
    const themeOptions: Array<{ key: "light" | "dark" | "system"; label: string; icon: any; kws: string[] }> = [
      { key: "light",  label: "Tema claro",   icon: Sun,     kws: ["light","claro","tema"] },
      { key: "dark",   label: "Tema oscuro",  icon: Moon,    kws: ["dark","oscuro","tema","noche"] },
      { key: "system", label: "Tema sistema", icon: Monitor, kws: ["system","sistema","auto","tema"] },
    ]
    for (const opt of themeOptions) {
      items.push({
        id:       `t:${opt.key}`,
        kind:     "action",
        title:    opt.label,
        subtitle: theme === opt.key ? "Activo" : `Cambiar a ${opt.label.toLowerCase()}`,
        icon:     opt.icon,
        action:   () => { setTheme(opt.key); toast.success(`Tema: ${opt.label.toLowerCase()}`) },
        group:    "Tema",
        keywords: opt.kws,
      })
    }

    // View-As (developer only — el context devuelve members vacío si no sos developer)
    if (members.length > 0) {
      if (isViewing) {
        items.push({
          id:       "va:clear",
          kind:     "action",
          title:    "Volver a mi identidad real",
          subtitle: viewAsUser ? `Simulando ${viewAsUser.full_name || viewAsUser.email}` : "Salir de View-As",
          icon:     EyeOff,
          action:   () => { clearViewAs(); toast.info("Volviste a tu identidad real") },
          group:    "Vista As",
          keywords: ["view","as","clear","real","developer","volver"],
        })
      }
      for (const m of members) {
        const name = m.full_name || m.email || "Sin nombre"
        items.push({
          id:       `va:${m.id}`,
          kind:     "action",
          title:    `Ver como ${name}`,
          subtitle: m.email ?? "—",
          icon:     Eye,
          action:   () => {
            setViewAsUser(m)
            toast.info(`Simulando ${name}`, 4000)
          },
          group:    "Vista As",
          keywords: [m.email ?? "", m.role, name.toLowerCase()],
        })
      }
    }

    return items
  }, [departments, members, theme, setTheme, isViewing, clearViewAs, setViewAsUser, toast, viewAsUser])

  // ─── Filtered + ranked ─────────────────────────────────────────────────
  const all = useMemo(() => [...allItems, ...dataItems], [allItems, dataItems])

  const filtered: Item[] = useMemo(() => {
    const q = query.trim()
    if (!q) {
      // Sin query: muestro Recientes + estática (sin data items que floodean).
      const recentItems = recents
        .map(id => allItems.find(i => i.id === id))
        .filter(Boolean)
        .map(i => ({ ...i!, group: "Recientes" }))
      return [...recentItems, ...allItems]
    }
    return all
      .map(i => ({ item: i, s: score(i, q) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(x => x.item)
  }, [all, allItems, query, recents])

  // Cerrar sesión como última opción siempre
  const finalResults: Item[] = useMemo(() => {
    if (!onSignOut) return filtered
    const q = query.toLowerCase().trim()
    if (!q || "cerrar sesión salir signout logout sign out".includes(q)) {
      return [...filtered, {
        id: "a:signout", kind: "action" as const,
        title: "Cerrar sesión", icon: LogOut, group: "Cuenta",
        action: () => { onSignOut() },
      }]
    }
    return filtered
  }, [filtered, query, onSignOut])

  // ─── Reset on open ─────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery("")
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // ─── Keyboard nav ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, finalResults.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIdx(i => Math.max(i - 1, 0))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const item = finalResults[activeIdx]
        if (item) trigger(item)
      } else if (e.key === "Home") {
        e.preventDefault()
        setActiveIdx(0)
      } else if (e.key === "End") {
        e.preventDefault()
        setActiveIdx(Math.max(0, finalResults.length - 1))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, activeIdx, finalResults, onClose, trigger])

  // ─── Auto-scroll selected into view ────────────────────────────────────
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [activeIdx])

  // ─── Group preserving rank ─────────────────────────────────────────────
  const grouped: { group: string; items: Item[] }[] = useMemo(() => {
    const map = new Map<string, Item[]>()
    finalResults.forEach(i => {
      const list = map.get(i.group) ?? []
      list.push(i)
      map.set(i.group, list)
    })
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }))
  }, [finalResults])

  if (!open) return null

  let runningIdx = -1

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
      onClick={onClose}
    >
      {/* Backdrop — dim oscuro intencional, sirve para ambos modos */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" />

      {/* Modal */}
      <div
        className="relative w-full max-w-[640px] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[0_30px_80px_rgba(15,23,42,0.30)] page-enter"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
            placeholder="Buscar páginas, tareas, personas, comandos…"
            className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
          {finalResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="h-6 w-6 text-muted-foreground/70 mb-3" />
              <p className="text-sm text-muted-foreground">Sin resultados para <span className="text-foreground">"{query}"</span></p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">Probá con otro término.</p>
            </div>
          ) : (
            grouped.map((g, gi) => (
              <div key={g.group} className={gi > 0 ? "mt-1" : ""}>
                <div className="px-5 pt-3 pb-1.5 flex items-center gap-1.5">
                  {g.group === "Recientes" && <Clock className="h-3 w-3 text-muted-foreground/70" />}
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {g.group}
                  </p>
                </div>
                <div>
                  {g.items.map(item => {
                    runningIdx++
                    const localIdx = runningIdx
                    const Icon = item.icon
                    const isActive = activeIdx === localIdx
                    const isCurrentPage = item.href && (pathname === item.href.split("?")[0])

                    return (
                      <button
                        key={`${g.group}-${item.id}`}
                        data-idx={localIdx}
                        onClick={() => trigger(item)}
                        onMouseEnter={() => setActiveIdx(localIdx)}
                        className={`group flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                          isActive ? "bg-muted" : "hover:bg-muted/60"
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors ${
                            isActive ? "bg-[#E42D2C]/15" : "bg-muted"
                          }`}
                          style={item.iconColor ? { backgroundColor: `${item.iconColor}1f` } : undefined}
                        >
                          <Icon
                            className={`h-4 w-4 ${isActive ? "text-[#ff6b6a]" : "text-muted-foreground"}`}
                            style={item.iconColor ? { color: item.iconColor } : undefined}
                          />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[14px] font-medium text-foreground truncate">
                              {item.title}
                            </p>
                            {isCurrentPage && (
                              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                                Actual
                              </span>
                            )}
                          </div>
                          {item.subtitle && (
                            <p className="text-[12px] text-muted-foreground truncate">{item.subtitle}</p>
                          )}
                        </div>

                        {/* Keyboard hint */}
                        {item.hint && (
                          <kbd className={`hidden sm:inline-flex items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono font-semibold transition-colors ${
                            isActive
                              ? "border-foreground/20 text-foreground"
                              : "border-border text-muted-foreground"
                          }`}>
                            {item.hint}
                          </kbd>
                        )}

                        <ArrowRight className={`h-3.5 w-3.5 shrink-0 transition-all ${
                          isActive ? "text-[#ff6b6a] translate-x-0.5" : "text-muted-foreground/70"
                        }`} />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/50 px-5 py-2.5">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[9px] font-semibold">↑↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[9px] font-semibold">↵</kbd>
              abrir
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[9px] font-semibold">?</kbd>
              atajos
            </span>
          </div>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Command className="h-3 w-3" />
            <span className="font-semibold tracking-wider">{finalResults.length}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
