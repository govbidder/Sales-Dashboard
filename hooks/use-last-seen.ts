"use client"

/**
 * useLastSeen — tracking de "última vez que el user vio X".
 *
 * Pattern GitHub / Linear / Slack: cuando abrís el dashboard a las 7am
 * tenés que ver INMEDIATAMENTE "qué cambió desde la última vez". Sin
 * esto, abrir el dashboard se siente como re-explorar manualmente.
 *
 * V1: persistencia en localStorage (per-device). Para founders que
 * usan mayormente una máquina alcanza. Si en el futuro el equipo crece
 * y necesitan cross-device, se promueve a una tabla `user_last_seen`
 * en Supabase con la misma API.
 *
 * El timestamp guardado es el de la MARCA (cuando el user llamó
 * `markSeen()`). El timestamp PREVIO se devuelve junto al actual para
 * que el caller pueda comparar contra updated_at de items y decidir
 * qué pintar como "nuevo".
 *
 * API:
 *   const { previousSeen, markSeen } = useLastSeen("inicio")
 *   // previousSeen: ISO string | null   (lo que estaba ANTES de hoy)
 *   // markSeen():                       (actualiza al timestamp de ahora)
 *
 * Convención: llamar markSeen() al final de un fetch exitoso para no
 * "perder" cambios si la página no termina de cargar.
 */

import { useCallback, useEffect, useState } from "react"

const KEY_PREFIX = "govbidder_last_seen_"

export function useLastSeen(key: string) {
  // previousSeen: el valor que existía cuando montó el hook. Lo capturo
  // una sola vez y NO se actualiza con cada markSeen (sino el caller
  // perdería la baseline contra la que comparar).
  const [previousSeen, setPreviousSeen] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem(KEY_PREFIX + key)
      setPreviousSeen(stored)
    } catch { /* silent — private mode */ }
    // Solo lee al mount. markSeen sobrescribe pero NO triggerea re-render
    // de previousSeen — el caller usa el valor capturado al mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markSeen = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(KEY_PREFIX + key, new Date().toISOString())
    } catch { /* silent */ }
  }, [key])

  return { previousSeen, markSeen }
}

/**
 * Helper puro: cuenta items con `updated_at` > previousSeen.
 * Devuelve 0 si no hay baseline (primer visit — no marcamos "nuevos").
 */
export function countNewSince<T extends { updated_at?: string | null; created_at?: string }>(
  items: T[],
  previousSeen: string | null,
): number {
  if (!previousSeen) return 0
  const baseline = new Date(previousSeen).getTime()
  return items.reduce((n, item) => {
    const ts = item.updated_at ?? item.created_at
    if (!ts) return n
    return new Date(ts).getTime() > baseline ? n + 1 : n
  }, 0)
}

/** Helper puro: predicado "es nuevo desde la última visita". */
export function isNewSince(
  item: { updated_at?: string | null; created_at?: string },
  previousSeen: string | null,
): boolean {
  if (!previousSeen) return false
  const ts = item.updated_at ?? item.created_at
  if (!ts) return false
  return new Date(ts).getTime() > new Date(previousSeen).getTime()
}
