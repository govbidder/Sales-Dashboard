"use client"

/**
 * useEffectiveIdentity — combina la identidad REAL del caller con el
 * view-as activo, devolviendo lo que UI deberían usar para gating /
 * destacado visual.
 *
 * Reglas:
 * - Si user real es developer Y hay viewAsUser → todos los datos vienen
 *   del user simulado (role, departmentId, userId).
 * - Si user real es developer Y hay viewAsRole / viewAsDepartmentId
 *   (sin user) → usa esos valores, complementa con real para lo no seteado.
 * - En cualquier otro caso (no developer, o sin viewAs) → todo del real.
 *
 * NO usar para gates server-side. Solo defensa visual.
 */

import { useViewAs } from "@/lib/contexts/view-as-context"
import { type Role, isDeveloper } from "@/lib/types/role"

export interface EffectiveIdentity {
  role:         Role | null
  departmentId: string | null
  userId:       string | null
  isSimulating: boolean
}

export function useEffectiveIdentity(
  realRole:         Role | null | undefined,
  realUserId?:      string | null,
  realDepartmentId?: string | null,
): EffectiveIdentity {
  const { viewAsRole, viewAsDepartmentId, viewAsUser, isViewing } = useViewAs()

  const devSimulating = isDeveloper(realRole) && isViewing

  if (!devSimulating) {
    return {
      role:         realRole ?? null,
      departmentId: realDepartmentId ?? null,
      userId:       realUserId ?? null,
      isSimulating: false,
    }
  }

  // Si hay viewAsUser, prioriza sus datos.
  if (viewAsUser) {
    return {
      role:         viewAsUser.role,
      departmentId: viewAsUser.department_id ?? null,
      userId:       viewAsUser.id,
      isSimulating: true,
    }
  }

  // Si no, combina viewAsRole / viewAsDepartmentId con real para los huecos.
  return {
    role:         viewAsRole ?? realRole ?? null,
    departmentId: viewAsDepartmentId ?? realDepartmentId ?? null,
    userId:       realUserId ?? null,
    isSimulating: true,
  }
}
