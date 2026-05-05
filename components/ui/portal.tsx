"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

/**
 * Renders children into document.body via React Portal.
 *
 * Why this exists: any ancestor element with a non-`none` `transform`,
 * `filter`, `perspective`, `will-change`, `contain`, or similar property
 * creates a "containing block" that captures `position: fixed` descendants —
 * so a fixed drawer inside such a tree can be visually clipped or stacked
 * incorrectly. The dashboard's page-enter animation does exactly this.
 *
 * Portaling to <body> escapes those contexts entirely. Use this for any
 * full-screen overlay (drawers, modals, dialogs, command palettes).
 *
 * Returns null on the server so Next.js SSR doesn't try to access `document`.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted || typeof document === "undefined") return null
  return createPortal(children, document.body)
}
