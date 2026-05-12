/**
 * Permisos de edición sobre `resources` (Centro Operativo).
 *
 * Regla (opción "lectura libre + edición restringida"):
 *  - Cualquier user autenticado puede LEER cualquier resource (RLS lo permite,
 *    y el API GET no filtra). Este helper solo cubre crear/editar/borrar.
 *  - admin+ (developer / super_admin / admin) puede modificar cualquier resource.
 *  - viewer NUNCA puede modificar.
 *  - user normal:
 *      · Recursos NO-SOP (recursos-internos, accesos): puede modificar (legacy —
 *        comportamiento anterior antes de departamentos). Como nadie esperaba
 *        que tener un user normal modifique accesos sea problemático, lo
 *        mantenemos abierto para no romper UX existente.
 *      · SOPs sin department_id ("Sin asignar" → globales): solo admin+.
 *      · SOPs con department_id: el user debe pertenecer al mismo departamento.
 *
 * Para crear un SOP `nuevo`, se valida el `department_id` que el cliente envía:
 *  - admin+: cualquier valor (incluido null).
 *  - user: el server fuerza a su propio department_id si manda otro o null.
 *    Si el user no tiene department_id, no puede crear SOPs.
 */

import { isAdminOrAbove, type Role } from "@/lib/types/role"

export const SOP_CATEGORIES = ["sop-sistemas", "sop-operativos"] as const
export type SopCategory = (typeof SOP_CATEGORIES)[number]

export function isSopCategory(category: string | null | undefined): category is SopCategory {
  return category === "sop-sistemas" || category === "sop-operativos"
}

/** ¿Puede este caller modificar un resource existente? */
export function canModifyResource(
  callerRole:    Role | null | undefined,
  callerDeptId:  string | null | undefined,
  resource:      { category: string | null; department_id: string | null },
): boolean {
  if (!callerRole || callerRole === "viewer") return false
  if (isAdminOrAbove(callerRole)) return true

  // user normal: para recursos NO-SOP mantenemos comportamiento legacy abierto.
  if (!isSopCategory(resource.category)) return true

  // SOP global → solo admin+.
  if (!resource.department_id) return false

  // SOP de un depto → user debe pertenecer al mismo depto.
  return !!callerDeptId && callerDeptId === resource.department_id
}

/**
 * ¿Puede este caller crear un resource en la categoría/depto dados?
 *
 * - admin+: siempre puede.
 * - user: si es un SOP, debe pertenecer a un depto y solo puede crear ahí;
 *   si NO es SOP, puede crear libremente (comportamiento legacy).
 * - viewer: nunca.
 *
 * Para SOPs, este helper también NORMALIZA el department_id que el cliente
 * envió: si un user manda null o un depto ajeno, el server fuerza a su propio
 * department_id. Devuelve `{ allowed: false }` solo cuando es imposible
 * (viewer, o user sin departamento intentando crear SOP).
 */
export function resolveCreateResource(
  callerRole:    Role | null | undefined,
  callerDeptId:  string | null | undefined,
  intent:        { category: string | null; department_id: string | null },
): { allowed: true; departmentId: string | null } | { allowed: false; reason: string } {
  if (!callerRole || callerRole === "viewer") {
    return { allowed: false, reason: "No tenés permisos para crear recursos." }
  }
  if (isAdminOrAbove(callerRole)) {
    return { allowed: true, departmentId: intent.department_id }
  }
  if (!isSopCategory(intent.category)) {
    return { allowed: true, departmentId: intent.department_id }
  }
  // user creando SOP — debe pertenecer a un depto.
  if (!callerDeptId) {
    return { allowed: false, reason: "Tu cuenta no tiene departamento asignado. Pedile a un admin que te asigne uno antes de crear SOPs." }
  }
  // Forzamos al propio depto sin importar lo que pidió el cliente — evita que
  // el form se pueda manipular para crear SOPs en otra área.
  return { allowed: true, departmentId: callerDeptId }
}
