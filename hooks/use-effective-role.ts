"use client"

/**
 * useEffectiveRole — wrapper de `useEffectiveIdentity` que solo devuelve
 * el rol simulado. Backward compat para consumidores que solo necesitan
 * el rol (sidebar, gates de botones de admin).
 *
 * Si necesitás también departmentId / userId, usar useEffectiveIdentity
 * directamente.
 */

import { useEffectiveIdentity } from "@/hooks/use-effective-identity"
import { type Role } from "@/lib/types/role"

export function useEffectiveRole(realRole: Role | null | undefined): Role | null {
  return useEffectiveIdentity(realRole).role
}
