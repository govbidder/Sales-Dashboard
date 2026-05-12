"use client"

/**
 * Wrapper sobre `fetch` que automáticamente agrega el header
 * `X-View-As-User-Id` cuando hay un viewAs user activo en localStorage.
 *
 * El header solo es respetado por el server si el JWT pertenece a un
 * usuario con rol developer real — ver `lib/auth/get-effective-user.ts`.
 *
 * Usar este wrapper en lugar de `fetch` directo en las views que pegan
 * a /api/* y deben respetar la simulación.
 */

const KEY = "viewAsUser"
export const VIEW_AS_HEADER = "X-View-As-User-Id"

function getViewAsUserId(): string | null {
  if (typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem(KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as { id?: string }
    return parsed?.id ?? null
  } catch {
    return null
  }
}

export async function fetchWithViewAs(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const userId = getViewAsUserId()
  if (!userId) return fetch(input, init)

  const headers = new Headers(init?.headers)
  headers.set(VIEW_AS_HEADER, userId)
  return fetch(input, { ...init, headers })
}
