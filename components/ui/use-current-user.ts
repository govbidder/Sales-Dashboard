"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { type Role, isAdminOrAbove, isDeveloper } from "@/lib/types/role"

export interface CurrentUser {
  id:    string
  email: string
  name:  string
  role:  Role
}

/**
 * Hook que devuelve el usuario actual + su rol resuelto desde profiles.
 *
 *   const { user, loading, isAdmin, isViewer, can } = useCurrentUser()
 *   if (can("delete:task")) { ... }
 *
 * Pattern simple — para perms más finos, extender el switch en `can`.
 */
export function useCurrentUser() {
  const [user,    setUser]    = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        if (!session?.user) { setUser(null); return }
        const u = session.user
        const { data: profile } = await sb.from("profiles")
          .select("role,full_name")
          .eq("id", u.id)
          .maybeSingle()
        setUser({
          id:    u.id,
          email: u.email ?? "",
          name:  (profile?.full_name as string) ?? u.email?.split("@")[0] ?? "",
          role:  ((profile?.role as string) ?? "user") as CurrentUser["role"],
        })
      } finally { setLoading(false) }
    }
    load()
  }, [])

  const isAdmin  = isAdminOrAbove(user?.role)  // admin | super_admin | developer
  const isDev    = isDeveloper(user?.role)
  const isUser   = user?.role === "user" || isAdmin
  const isViewer = user?.role === "viewer"

  /**
   * Capability check. Lista de capabilities crece con el tiempo.
   * Convención: "<verbo>:<entidad>"
   */
  const can = (capability: string): boolean => {
    if (!user) return false
    if (isAdmin) return true
    switch (capability) {
      // Viewers: todo prohibido (solo lectura)
      case "delete:task":
      case "delete:persona":
      case "delete:form":
      case "delete:template":
      case "delete:status_set":
      case "edit:status_set":
      case "edit:report":
      case "view:audit_log":
        return false   // solo admin (cubierto por el guard de arriba)

      // Users: pueden crear y modificar tasks, personas, forms
      case "create:task":
      case "edit:task":
      case "create:persona":
      case "edit:persona":
      case "create:form":
      case "edit:form":
      case "create:template":
      case "edit:template":
        return isUser

      default:
        return isUser
    }
  }

  return { user, loading, isAdmin, isDev, isUser, isViewer, can }
}
