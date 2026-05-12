/** Roles del sistema, en orden de jerarquía descendente. */
export type Role = "super_admin" | "admin" | "user" | "viewer"

/** Label mostrado en UI por rol. */
export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super admin",
  admin:       "Admin",
  user:        "Empleado",
  viewer:      "Solo lectura",
}

/** Roles que un admin puede asignar al invitar/editar (NO incluye super_admin). */
export const ROLES_ASSIGNABLE_BY_ADMIN: Role[] = ["admin", "user", "viewer"]

/** Roles que un super_admin puede asignar (todos). */
export const ROLES_ASSIGNABLE_BY_SUPER_ADMIN: Role[] = ["super_admin", "admin", "user", "viewer"]

/** ¿Es admin o por encima? (incluye super_admin) */
export function isAdminOrAbove(role: Role | null | undefined): boolean {
  return role === "admin" || role === "super_admin"
}

/** ¿Es super_admin exacto? */
export function isSuperAdmin(role: Role | null | undefined): boolean {
  return role === "super_admin"
}

/** ¿Es empleado? (rol user) */
export function isEmployee(role: Role | null | undefined): boolean {
  return role === "user"
}
