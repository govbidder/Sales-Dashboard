"use client"

/**
 * useEffectiveRole — combina el rol REAL del usuario con el viewAs activo.
 *
 * Si el user real es developer Y hay viewAs activo → devuelve el rol simulado.
 * En cualquier otro caso → devuelve el rol real.
 *
 * Usar este hook (y NO el rol real directo) en cualquier component que
 * gatea visualmente (sidebar items, botones de admin, modales).
 *
 * NO usar para gates server-side, llamadas a la API o lógica de seguridad —
 * para eso siempre el rol real. El servidor NUNCA debe confiar en este valor.
 */

import { useViewAs } from "@/lib/contexts/view-as-context"
import { type Role, isDeveloper } from "@/lib/types/role"

export function useEffectiveRole(realRole: Role | null | undefined): Role | null {
  const { viewAsRole } = useViewAs()
  // Solo aplica simulación cuando el real es developer (el provider ya lo gatea,
  // pero doble-check defensivo por si algún consumidor usa el hook sin envolver).
  if (isDeveloper(realRole) && viewAsRole) return viewAsRole
  return realRole ?? null
}
