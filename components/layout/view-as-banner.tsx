"use client"

/**
 * Banner sticky en el top del dashboard cuando hay View-As activo.
 * Refleja qué se está simulando:
 *  - viewAsUser → "Viendo como [Nombre]"
 *  - viewAsRole + dept → "Viendo como [Rol] de [Depto]"
 *  - viewAsRole solo → "Viendo como [Rol]"
 *  - solo dept → "Viendo solo el depto [Depto]"
 *
 * Color ámbar intencional — no usa theme vars porque el objetivo es
 * que NO se confunda con la app real.
 */

import { Eye, X } from "lucide-react"
import { useViewAs } from "@/lib/contexts/view-as-context"
import { ROLE_LABEL } from "@/lib/types/role"

export function ViewAsBanner() {
  const {
    viewAsRole, viewAsDepartmentId, viewAsUser,
    departments, clearViewAs, isViewing,
  } = useViewAs()

  if (!isViewing) return null

  const deptName = viewAsDepartmentId
    ? (departments.find(d => d.id === viewAsDepartmentId)?.name ?? null)
    : null

  // Compose label
  let title = ""
  let extra = ""
  if (viewAsUser) {
    const name = viewAsUser.full_name || viewAsUser.email || "Usuario"
    title = `Viendo como ${name}`
    extra = `${ROLE_LABEL[viewAsUser.role]}${deptName ? ` · ${deptName}` : ""}`
  } else if (viewAsRole && deptName) {
    title = `Viendo como ${ROLE_LABEL[viewAsRole]} de ${deptName}`
  } else if (viewAsRole) {
    title = `Viendo como ${ROLE_LABEL[viewAsRole]}`
  } else if (deptName) {
    title = `Filtrado al depto ${deptName}`
  }

  // Subtítulo refleja con precisión qué hace el server:
  // - viewAsUser activo → server respeta el header X-View-As-User-Id y
  //   devuelve solo lo que vería ese usuario.
  // - cualquier otro caso (rol-solo, dept-solo, rol+dept sin user) →
  //   sólo afecta la UI; el server te trata como Developer real.
  const subtitle = viewAsUser
    ? "El servidor también respeta esta simulación — la data viene filtrada como la vería ese usuario."
    : "Esto es solo visual — el servidor sigue tratándote como Developer."

  return (
    <div className="sticky top-0 z-[60] w-full bg-amber-400 text-amber-950 shadow-[0_2px_8px_rgba(180,83,9,0.25)]">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-bold leading-tight truncate">
              {title}
              {extra && (
                <span className="ml-2 text-[11px] font-semibold text-amber-950/75">
                  ({extra})
                </span>
              )}
            </p>
            <p className="hidden sm:block text-[11px] text-amber-950/75 leading-tight truncate">
              {subtitle}
            </p>
          </div>
        </div>
        <button
          onClick={clearViewAs}
          className="flex items-center gap-1.5 rounded-lg bg-amber-950/15 px-2.5 py-1 text-[12px] font-bold text-amber-950 hover:bg-amber-950/25 transition-all shrink-0"
        >
          <X className="h-3.5 w-3.5" />
          Volver a Developer
        </button>
      </div>
    </div>
  )
}
