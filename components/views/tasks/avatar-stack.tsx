"use client"

/**
 * AvatarStack — stack de avatares de usuarios solapados.
 *
 * Reutilizable en TaskCard (lista de assignees), bulk bar (selected
 * users), etc. Aplica gradient brand a las initials para mantener
 * consistencia visual con el resto del dashboard.
 */

import { initials } from "./_helpers"

interface Props {
  users: string[]
  size?: "sm" | "md"
}

export function AvatarStack({ users, size = "sm" }: Props) {
  if (!users.length) return null
  const dim = size === "md" ? "h-7 w-7 text-[11px]" : "h-5 w-5 text-[9px]"
  const visible = users.slice(0, 3)
  const extra   = users.length - visible.length
  return (
    <div className="flex -space-x-1.5">
      {visible.map((u, i) => (
        <div
          key={i}
          title={u}
          className={`${dim} flex items-center justify-center rounded-full ring-2 ring-background bg-gradient-to-br from-[#E42D2C] to-[#1e3a8a] font-bold text-white`}
        >
          {initials(u)}
        </div>
      ))}
      {extra > 0 && (
        <div className={`${dim} flex items-center justify-center rounded-full ring-2 ring-background bg-muted text-muted-foreground font-bold`}>
          +{extra}
        </div>
      )}
    </div>
  )
}
