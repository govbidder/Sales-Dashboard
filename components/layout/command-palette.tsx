"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import {
  Search, ArrowRight, Command, BarChart3, DollarSign, LayoutGrid,
  FileBarChart, Users2, ListTodo, Users, Layers, Wrench, BookOpen,
  CalendarDays, Plus, LogOut, Activity, User as UserIcon, CheckSquare,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemKind = "page" | "action"

interface Item {
  id:       string
  kind:     ItemKind
  title:    string
  subtitle?: string
  hint?:    string
  icon:     any
  href?:    string
  group:    string
  keywords?: string[]
  action?:  () => void
}

// ─── Item registry ────────────────────────────────────────────────────────────

const PAGES: Item[] = [
  // Inicio (smart home)
  { id: "p:inicio",    kind: "page", title: "Página Principal", subtitle: "Estado del dashboard · qué requiere atención", icon: Activity, href: "/inicio", group: "Inicio", keywords: ["home","inicio","auditoria","estado","health"] },

  // General
  { id: "p:dashboard", kind: "page", title: "Panel",           subtitle: "KPIs, rentabilidad, proyecciones", icon: BarChart3,    href: "/dashboard",       group: "General", keywords: ["dashboard","home","kpi","resumen"] },
  { id: "p:revenue",   kind: "page", title: "Ingresos",        subtitle: "Embudo de ventas",                icon: DollarSign,   href: "/sales",           group: "General", keywords: ["sales","ventas","revenue","funnel"] },
  { id: "p:metrics",   kind: "page", title: "Métricas",        subtitle: "Tabla completa de KPIs",          icon: LayoutGrid,   href: "/metrics",         group: "General", keywords: ["todas","tabla","numbers"] },
  { id: "p:reports",   kind: "page", title: "Cargar Métricas", subtitle: "Form mensual de KPIs",            icon: FileBarChart, href: "/admin/reports",   group: "General", keywords: ["input","form","mes","cargar","reports"] },

  // Operación
  { id: "p:personas", kind: "page", title: "Personas Agendadas", subtitle: "Pipeline de prospectos",       icon: Users2,   href: "/admin/personas",         group: "Operación", keywords: ["leads","prospectos","calls"] },
  { id: "p:tasks",    kind: "page", title: "Tareas",             subtitle: "Gestión de pendientes",        icon: ListTodo, href: "/admin/tasks",            group: "Operación", keywords: ["todo","kanban","trabajo","tasks"] },
  { id: "p:team",     kind: "page", title: "Equipo",             subtitle: "Miembros del equipo",          icon: Users,    href: "/admin/team",             group: "Operación", keywords: ["staff","gente","empleados","team"] },
  { id: "p:ops",      kind: "page", title: "Centro Operativo",   subtitle: "Wiki interna · SOPs",          icon: Layers,   href: "/admin/centro-operativo", group: "Operación", keywords: ["sop","wiki","procedimientos","operations"] },

  // Programa
  { id: "p:tools",    kind: "page", title: "Herramientas",subtitle: "Tools internos",          icon: Wrench,        href: "/tools",    group: "Programa", keywords: ["tools","links","apps"] },
  { id: "p:resources",kind: "page", title: "Recursos",    subtitle: "Biblioteca interna",      icon: BookOpen,      href: "/recursos", group: "Programa", keywords: ["resources","biblioteca","docs"] },
  { id: "p:schedule", kind: "page", title: "Agenda",      subtitle: "Calendario del equipo",   icon: CalendarDays,  href: "/calendar", group: "Programa", keywords: ["schedule","calendario","calendar"] },
]

const QUICK_ACTIONS = (router: ReturnType<typeof useRouter>): Item[] => [
  { id: "a:new-persona", kind: "action", title: "Nueva persona agendada", icon: Plus, group: "Acciones",
    href: "/admin/personas?new=1",
    keywords: ["lead","crear","persona"] },
  { id: "a:new-task", kind: "action", title: "Nueva tarea", icon: Plus, group: "Acciones",
    href: "/admin/tasks?new=1",
    keywords: ["task","todo","crear"] },
  { id: "a:load-metrics", kind: "action", title: "Cargar métricas del mes", icon: FileBarChart, group: "Acciones",
    href: "/admin/reports",
    keywords: ["mes","reportes","kpi"] },
  { id: "a:invite-member", kind: "action", title: "Invitar al equipo", icon: Users, group: "Acciones",
    href: "/admin/team?invite=1",
    keywords: ["nuevo","miembro","email"] },
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

  // Exact title prefix → highest
  if (title.startsWith(q)) return 100 + (q.length / title.length) * 50
  // Title contains → high
  if (title.includes(q))   return 70  + (q.length / title.length) * 20
  // Subtitle contains → medium
  if (subtitle.includes(q)) return 40
  // Keyword match → medium-low
  if (kws.includes(q))      return 30
  // Sequential characters in haystack (loose fuzzy)
  let i = 0, j = 0, hits = 0
  while (i < haystack.length && j < q.length) {
    if (haystack[i] === q[j]) { hits++; j++ }
    i++
  }
  if (hits === q.length) return 10 + hits
  return 0
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open:    boolean
  onClose: () => void
  onSignOut?: () => void
}

export function CommandPalette({ open, onClose, onSignOut }: CommandPaletteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery]     = useState("")
  const [activeIdx, setActiveIdx] = useState(0)
  const [dataItems, setDataItems] = useState<Item[]>([])

  // Lazy-load personas + tasks once when palette opens, for content search.
  useEffect(() => {
    if (!open || dataItems.length > 0) return
    let aborted = false
    async function load() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const headers = { Authorization: `Bearer ${session.access_token}` }
        const [personasRes, tasksRes] = await Promise.all([
          fetch("/api/admin/personas", { headers }),
          fetch("/api/admin/tasks?include_subtasks=true", { headers }),
        ])
        const personas = personasRes.ok ? (await personasRes.json()).personas ?? [] : []
        const tasks    = tasksRes.ok    ? (await tasksRes.json()).tasks ?? []        : []
        if (aborted) return
        const items: Item[] = [
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
        ]
        setDataItems(items)
      } catch { /* fail silently */ }
    }
    load()
    return () => { aborted = true }
  }, [open, dataItems.length])

  const all: Item[] = useMemo(() => {
    const actions = QUICK_ACTIONS(router)
    return [...PAGES, ...actions, ...dataItems]
  }, [router, dataItems])

  const filtered: Item[] = useMemo(() => {
    if (!query.trim()) {
      // Don't show data items when palette opens with no query (would flood)
      return all.filter(i => !i.id.startsWith("data:"))
    }
    return all
      .map(i => ({ item: i, s: score(i, query) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(x => x.item)
  }, [all, query])

  // Add sign out as last result if matched
  const finalResults: Item[] = useMemo(() => {
    if (!onSignOut) return filtered
    const q = query.toLowerCase().trim()
    if (!q || "cerrar sesión salir signout logout".includes(q)) {
      return [...filtered, {
        id: "a:signout", kind: "action" as const,
        title: "Cerrar sesión", icon: LogOut, group: "Cuenta",
        action: onSignOut,
      }]
    }
    return filtered
  }, [filtered, query, onSignOut])

  const trigger = (item: Item) => {
    if (item.action) item.action()
    else if (item.href) router.push(item.href)
    onClose()
  }

  // Reset state on open
  useEffect(() => {
    if (open) {
      setQuery("")
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Keyboard nav
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
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, activeIdx, finalResults]) // eslint-disable-line

  // Group results in display order, preserving rank
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
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" />

      {/* Modal */}
      <div
        className="relative w-full max-w-[640px] overflow-hidden rounded-2xl border border-slate-200 shadow-[0_30px_80px_rgba(15,23,42,0.25)] page-enter"
        style={{ backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
            placeholder="Buscar páginas, acciones, atajos…"
            className="flex-1 bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {finalResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="h-6 w-6 text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">Sin resultados para <span className="text-slate-600">"{query}"</span></p>
              <p className="text-[11px] text-slate-300 mt-1">Probá con otro término o abrí el listado.</p>
            </div>
          ) : (
            grouped.map((g, gi) => (
              <div key={g.group} className={gi > 0 ? "mt-1" : ""}>
                <p className="px-5 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {g.group}
                </p>
                <div>
                  {g.items.map(item => {
                    runningIdx++
                    const localIdx = runningIdx
                    const Icon = item.icon
                    const isActive = activeIdx === localIdx
                    const isCurrentPage = item.href && (pathname === item.href || pathname?.startsWith(item.href + "/"))

                    return (
                      <button
                        key={item.id}
                        onClick={() => trigger(item)}
                        onMouseEnter={() => setActiveIdx(localIdx)}
                        className={`group flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                          isActive ? "bg-slate-100" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors ${
                          isActive ? "bg-[#E42D2C]/15 text-[#ff6b6a]" : "bg-slate-50 text-slate-500"
                        }`}>
                          <Icon className="h-4 w-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`text-[14px] font-medium truncate ${isActive ? "text-slate-900" : "text-slate-800"}`}>
                              {item.title}
                            </p>
                            {isCurrentPage && (
                              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                                Actual
                              </span>
                            )}
                          </div>
                          {item.subtitle && (
                            <p className="text-[12px] text-slate-400 truncate">{item.subtitle}</p>
                          )}
                        </div>

                        <ArrowRight className={`h-3.5 w-3.5 shrink-0 transition-all ${
                          isActive ? "text-[#ff6b6a] translate-x-0.5" : "text-slate-300"
                        }`} />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-2.5">
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold">↑↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold">↵</kbd>
              abrir
            </span>
          </div>
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <Command className="h-3 w-3" />
            <span className="font-semibold tracking-wider">GovBidder</span>
          </span>
        </div>
      </div>
    </div>
  )
}
