"use client"

/**
 * View-As context (milestones 2 + 3) — simulación CLIENT-SIDE de identidad.
 *
 * Solo accesible para usuarios reales con rol `developer`. El estado de
 * "viendo como X" vive en este context + localStorage. El servidor sigue
 * tratando al usuario como developer real — esta capa solo afecta lo
 * que la UI muestra/oculta/destaca (sidebar, botones, filtros visuales).
 *
 * Milestone 3 extiende a tres ejes simulables:
 *   - viewAsRole         → simular rol
 *   - viewAsDepartmentId → simular pertenencia a depto
 *   - viewAsUser         → simular un usuario REAL específico (combina
 *                          rol + depto + email + name, atomicamente)
 *
 * Para combinar con datos reales del caller, ver
 * `hooks/use-effective-identity.ts`.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { type Role, isDeveloper } from "@/lib/types/role"
import { createClient } from "@/lib/supabase"

// ─── localStorage keys ───────────────────────────────────────────────────────

const KEY_ROLE          = "viewAsRole"
const KEY_DEPARTMENT_ID = "viewAsDepartmentId"
const KEY_USER          = "viewAsUser"   // JSON stringified MemberLite

const VALID_ROLES: ReadonlyArray<Role> = ["developer", "super_admin", "admin", "user", "viewer"]

// ─── Types ───────────────────────────────────────────────────────────────────

/** Subset de Member usado para simular identidad. Stringificable a JSON. */
export interface ViewAsMember {
  id:            string
  email:         string | null
  full_name:     string | null
  role:          Role
  department_id: string | null
}

export interface DepartmentLite {
  id:    string
  name:  string
  color: string
}

interface ViewAsValue {
  /** Rol simulado, o null. */
  viewAsRole:         Role | null
  /** Depto simulado, o null. */
  viewAsDepartmentId: string | null
  /** Usuario simulado completo, o null. Se prioriza sobre rol/dept. */
  viewAsUser:         ViewAsMember | null
  /** Convenience: viewAsUser?.id ?? null. */
  viewAsUserId:       string | null

  /** Cache: lista de miembros del equipo (para el picker y el banner). */
  members:            ViewAsMember[]
  /** Cache: lista de departamentos (para el picker y el banner). */
  departments:        DepartmentLite[]

  setViewAsRole:         (role: Role | null) => void
  setViewAsDepartmentId: (id: string | null) => void
  /** Setea el user simulado completo (cascade a rol + dept). */
  setViewAsUser:         (member: ViewAsMember | null) => void
  /** Sets viewAsUser buscando en el cache members por id. No-op si no encuentra. */
  setViewAsUserId:       (id: string | null) => void
  /** Limpia los 3 ejes. */
  clearViewAs:           () => void

  /** true si alguno de los 3 ejes está activo. */
  isViewing:             boolean
}

const ViewAsContext = createContext<ViewAsValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

export function ViewAsProvider({
  realRole,
  children,
}: {
  realRole: Role | null
  children: React.ReactNode
}) {
  const enabled = isDeveloper(realRole)

  const [viewAsRole,         setRoleState]      = useState<Role | null>(null)
  const [viewAsDepartmentId, setDeptState]      = useState<string | null>(null)
  const [viewAsUser,         setUserState]      = useState<ViewAsMember | null>(null)
  const [members,            setMembers]        = useState<ViewAsMember[]>([])
  const [departments,        setDepartments]    = useState<DepartmentLite[]>([])

  // ─── Hydrate desde localStorage ───────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      setRoleState(null)
      setDeptState(null)
      setUserState(null)
      return
    }
    try {
      const storedRole = window.localStorage.getItem(KEY_ROLE)
      if (storedRole && VALID_ROLES.includes(storedRole as Role)) {
        setRoleState(storedRole as Role)
      } else if (storedRole) {
        window.localStorage.removeItem(KEY_ROLE)
      }

      const storedDept = window.localStorage.getItem(KEY_DEPARTMENT_ID)
      if (storedDept) setDeptState(storedDept)

      const storedUser = window.localStorage.getItem(KEY_USER)
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser) as ViewAsMember
          if (parsed && typeof parsed.id === "string" && VALID_ROLES.includes(parsed.role)) {
            setUserState(parsed)
          } else {
            window.localStorage.removeItem(KEY_USER)
          }
        } catch {
          window.localStorage.removeItem(KEY_USER)
        }
      }
    } catch { /* private mode */ }
  }, [enabled])

  // ─── Pre-fetch caches (team + departments) si soy developer ───────────────
  // Estos caches alimentan el picker en ViewAsDropdown y el banner/topbar
  // para resolver nombres legibles de los IDs guardados.
  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const headers = { Authorization: `Bearer ${session.access_token}` }
        const [teamRes, deptRes] = await Promise.all([
          fetch("/api/admin/team",  { headers }),
          fetch("/api/departments", { headers }),
        ])

        if (cancelled) return

        if (teamRes.ok) {
          const j = await teamRes.json()
          const lite: ViewAsMember[] = (j.members ?? []).map((m: any) => ({
            id:            m.id,
            email:         m.email ?? null,
            full_name:     m.full_name ?? null,
            role:          m.role as Role,
            department_id: m.department_id ?? null,
          }))
          setMembers(lite)
        }

        if (deptRes.ok) {
          const j = await deptRes.json()
          const lite: DepartmentLite[] = (j.departments ?? []).map((d: any) => ({
            id:    d.id,
            name:  d.name,
            color: d.color,
          }))
          setDepartments(lite)
        }
      } catch { /* silent */ }
    }
    load()
    return () => { cancelled = true }
  }, [enabled])

  // ─── Setters ──────────────────────────────────────────────────────────────

  const setViewAsRole = useCallback((role: Role | null) => {
    if (!enabled) return
    try {
      if (role === null) {
        window.localStorage.removeItem(KEY_ROLE)
      } else if (VALID_ROLES.includes(role)) {
        window.localStorage.setItem(KEY_ROLE, role)
      } else {
        return
      }
      setRoleState(role)
    } catch { /* silent */ }
  }, [enabled])

  const setViewAsDepartmentId = useCallback((id: string | null) => {
    if (!enabled) return
    try {
      if (id === null) window.localStorage.removeItem(KEY_DEPARTMENT_ID)
      else window.localStorage.setItem(KEY_DEPARTMENT_ID, id)
      setDeptState(id)
    } catch { /* silent */ }
  }, [enabled])

  const setViewAsUser = useCallback((member: ViewAsMember | null) => {
    if (!enabled) return
    try {
      if (member === null) {
        window.localStorage.removeItem(KEY_USER)
        // Cuando limpiás el user simulado, también limpio rol+dept asociados
        // — porque vienen del user. Si quieren simulación parcial, usan los
        // setters individuales después.
        window.localStorage.removeItem(KEY_ROLE)
        window.localStorage.removeItem(KEY_DEPARTMENT_ID)
        setUserState(null)
        setRoleState(null)
        setDeptState(null)
        return
      }
      if (!VALID_ROLES.includes(member.role)) return
      window.localStorage.setItem(KEY_USER, JSON.stringify(member))
      window.localStorage.setItem(KEY_ROLE, member.role)
      if (member.department_id) {
        window.localStorage.setItem(KEY_DEPARTMENT_ID, member.department_id)
      } else {
        window.localStorage.removeItem(KEY_DEPARTMENT_ID)
      }
      setUserState(member)
      setRoleState(member.role)
      setDeptState(member.department_id ?? null)
    } catch { /* silent */ }
  }, [enabled])

  /** Busca el member en el cache y delega a setViewAsUser. No-op si no encuentra. */
  const setViewAsUserId = useCallback((id: string | null) => {
    if (!enabled) return
    if (id === null) { setViewAsUser(null); return }
    const found = members.find(m => m.id === id)
    if (found) setViewAsUser(found)
  }, [enabled, members, setViewAsUser])

  const clearViewAs = useCallback(() => setViewAsUser(null), [setViewAsUser])

  const isViewing = enabled && (
    viewAsRole !== null ||
    viewAsDepartmentId !== null ||
    viewAsUser !== null
  )

  return (
    <ViewAsContext.Provider
      value={{
        viewAsRole:         enabled ? viewAsRole : null,
        viewAsDepartmentId: enabled ? viewAsDepartmentId : null,
        viewAsUser:         enabled ? viewAsUser : null,
        viewAsUserId:       enabled ? (viewAsUser?.id ?? null) : null,
        members:            enabled ? members : [],
        departments:        enabled ? departments : [],
        setViewAsRole,
        setViewAsDepartmentId,
        setViewAsUser,
        setViewAsUserId,
        clearViewAs,
        isViewing,
      }}
    >
      {children}
    </ViewAsContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook para consumir el contexto. Si no está envuelto en Provider,
 * devuelve un default no-op (seguro en SSR / tests).
 */
export function useViewAs(): ViewAsValue {
  const ctx = useContext(ViewAsContext)
  if (!ctx) {
    return {
      viewAsRole:            null,
      viewAsDepartmentId:    null,
      viewAsUser:            null,
      viewAsUserId:          null,
      members:               [],
      departments:           [],
      setViewAsRole:         () => {},
      setViewAsDepartmentId: () => {},
      setViewAsUser:         () => {},
      setViewAsUserId:       () => {},
      clearViewAs:           () => {},
      isViewing:             false,
    }
  }
  return ctx
}
