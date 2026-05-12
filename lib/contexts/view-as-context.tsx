"use client"

/**
 * View-As context (milestone 2/4) — simulación CLIENT-SIDE de roles.
 *
 * Solo accesible para usuarios reales con rol `developer`. El estado de
 * "viendo como X" vive en este context + localStorage. El servidor sigue
 * tratando al usuario como developer real — esta capa solo afecta lo
 * que la UI muestra/oculta (sidebar, botones, gates visuales).
 *
 * Para combinar con el rol real y obtener el "effective role" que
 * deberían usar los components, ver `hooks/use-effective-role.ts`.
 */

import { createContext, useContext, useEffect, useState } from "react"
import { type Role, isDeveloper } from "@/lib/types/role"

const LOCAL_KEY = "viewAsRole"
const VALID_ROLES: ReadonlyArray<Role> = ["developer", "super_admin", "admin", "user", "viewer"]

interface ViewAsValue {
  /** Rol que se está simulando, o null si no hay simulación activa. */
  viewAsRole:    Role | null
  /** Setea o limpia (null) el rol simulado. No-op si el user real no es developer. */
  setViewAsRole: (role: Role | null) => void
  /** Shortcut para volver al rol real. */
  clearViewAs:   () => void
  /** true si hay un viewAsRole distinto de null. */
  isViewing:     boolean
}

const ViewAsContext = createContext<ViewAsValue | null>(null)

export function ViewAsProvider({
  realRole,
  children,
}: {
  /** Rol REAL del usuario (de la DB, no afectado por viewAs). */
  realRole: Role | null
  children: React.ReactNode
}) {
  const enabled = isDeveloper(realRole)
  const [viewAsRole, setRole] = useState<Role | null>(null)

  // Hydrate desde localStorage solo si el user real es developer.
  useEffect(() => {
    if (!enabled) {
      setRole(null)
      return
    }
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(LOCAL_KEY) : null
      if (stored && VALID_ROLES.includes(stored as Role)) {
        setRole(stored as Role)
      } else if (stored) {
        // valor inválido → limpiar silenciosamente
        window.localStorage.removeItem(LOCAL_KEY)
      }
    } catch { /* localStorage puede fallar en private mode */ }
  }, [enabled])

  const setViewAsRole = (role: Role | null) => {
    if (!enabled) return
    try {
      if (role === null) {
        window.localStorage.removeItem(LOCAL_KEY)
        setRole(null)
        return
      }
      if (!VALID_ROLES.includes(role)) return
      window.localStorage.setItem(LOCAL_KEY, role)
      setRole(role)
    } catch { /* idem */ }
  }

  const clearViewAs = () => setViewAsRole(null)

  return (
    <ViewAsContext.Provider
      value={{
        viewAsRole: enabled ? viewAsRole : null,
        setViewAsRole,
        clearViewAs,
        isViewing: enabled && viewAsRole !== null,
      }}
    >
      {children}
    </ViewAsContext.Provider>
  )
}

/**
 * Hook para consumir el contexto. Si no está envuelto en Provider,
 * devuelve un default no-op (seguro en SSR / tests).
 */
export function useViewAs(): ViewAsValue {
  const ctx = useContext(ViewAsContext)
  if (!ctx) {
    return {
      viewAsRole:    null,
      setViewAsRole: () => {},
      clearViewAs:   () => {},
      isViewing:     false,
    }
  }
  return ctx
}
