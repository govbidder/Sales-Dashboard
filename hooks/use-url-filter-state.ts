"use client"

/**
 * useUrlFilterState — sync de state de filtros con URL query params.
 *
 * Pattern Linear/GitHub: la URL es la fuente de verdad para vistas
 * filtradas. Refrescá la página, mantenés los filtros. Compartí el
 * link, el otro user ve la misma vista.
 *
 * Diseño:
 *   - API igual a useState ([value, setValue]).
 *   - Lee el valor inicial del URL via useSearchParams.
 *   - Al setear, actualiza el URL con router.replace (sin push, para no
 *     llenar el historial con cada keystroke).
 *   - Si el valor coincide con el default, ELIMINA el param de la URL
 *     (URL limpia, sin "?priority=todos&assignee=todos&...").
 *   - Debounce opcional (default 0) — útil para inputs de texto.
 *
 * Uso:
 *   const [search, setSearch] = useUrlFilterState("q", "", { debounce: 200 })
 *   const [view, setView]     = useUrlFilterState("view", "board")
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

interface Options {
  /** ms de debounce para escrituras de URL. Default 0 (sin debounce). */
  debounce?: number
  /** Si true, persiste en URL incluso cuando es el default. Default false. */
  preserveDefault?: boolean
}

export function useUrlFilterState<T extends string | number>(
  key:     string,
  defaultValue: T,
  options: Options = {},
): [T, (next: T) => void] {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const { debounce = 0, preserveDefault = false } = options

  // Parse del default según tipo.
  const parse = useCallback((raw: string | null): T => {
    if (raw === null) return defaultValue
    if (typeof defaultValue === "number") {
      const n = Number(raw)
      return (Number.isFinite(n) ? n : defaultValue) as T
    }
    return raw as T
  }, [defaultValue])

  const [value, setValue] = useState<T>(() => parse(searchParams?.get(key) ?? null))

  // Sync inbound: si el URL cambia desde fuera (navegación, browser back),
  // reflejarlo en el state local.
  useEffect(() => {
    const fromUrl = parse(searchParams?.get(key) ?? null)
    setValue(prev => prev === fromUrl ? prev : fromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, key])

  // Debounced URL write
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const writeToUrl = useCallback((next: T) => {
    const apply = () => {
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      const isDefault = next === defaultValue
      if (isDefault && !preserveDefault) {
        params.delete(key)
      } else {
        params.set(key, String(next))
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
    if (debounce > 0) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(apply, debounce)
    } else {
      apply()
    }
  }, [router, pathname, searchParams, key, defaultValue, preserveDefault, debounce])

  // Setter público — actualiza state local Y URL.
  const setUrl = useCallback((next: T) => {
    setValue(next)
    writeToUrl(next)
  }, [writeToUrl])

  return [value, setUrl]
}
