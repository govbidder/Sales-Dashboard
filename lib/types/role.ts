/**
 * Roles del sistema, en orden de jerarquía descendente:
 *   developer > super_admin > admin > user > viewer
 *
 * - `developer`: máximo nivel. Para testing interno (un solo usuario).
 *   Pasa todos los gates de admin/super_admin sin excepción. Asignable
 *   solo vía scripts/promote-to-developer.ts (service role), NUNCA UI.
 */
export type Role = "developer" | "super_admin" | "admin" | "user" | "viewer"

/** Label mostrado en UI por rol. */
export const ROLE_LABEL: Record<Role, string> = {
  developer:   "Developer",
  super_admin: "Super admin",
  admin:       "Admin",
  user:        "Empleado",
  viewer:      "Solo lectura",
}

/** Roles que un admin puede asignar al invitar/editar (NO incluye super_admin ni developer). */
export const ROLES_ASSIGNABLE_BY_ADMIN: Role[] = ["admin", "user", "viewer"]

/** Roles que un super_admin puede asignar (no incluye developer — ese es solo via script). */
export const ROLES_ASSIGNABLE_BY_SUPER_ADMIN: Role[] = ["super_admin", "admin", "user", "viewer"]

/** ¿Es admin o por encima? (admin | super_admin | developer) */
export function isAdminOrAbove(role: Role | null | undefined): boolean {
  return role === "admin" || role === "super_admin" || role === "developer"
}

/** ¿Es super_admin o por encima? (super_admin | developer) — para gates de "manage admins". */
export function isSuperAdminOrAbove(role: Role | null | undefined): boolean {
  return role === "super_admin" || role === "developer"
}

/** ¿Es super_admin exacto? (NO incluye developer). */
export function isSuperAdmin(role: Role | null | undefined): boolean {
  return role === "super_admin"
}

/** ¿Es developer o por encima? (hoy equivale a isDeveloper — placeholder para futuras jerarquías). */
export function isDeveloperOrAbove(role: Role | null | undefined): boolean {
  return role === "developer"
}

/** ¿Es developer exacto? */
export function isDeveloper(role: Role | null | undefined): boolean {
  return role === "developer"
}

/** ¿Es empleado? (rol user) */
export function isEmployee(role: Role | null | undefined): boolean {
  return role === "user"
}
