"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  theme:        Theme
  resolvedTheme: "light" | "dark"
  setTheme:     (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = "govbidder_theme"

function applyTheme(t: "light" | "dark") {
  if (typeof document === "undefined") return
  const html = document.documentElement
  if (t === "dark") html.classList.add("dark")
  else              html.classList.remove("dark")
}

function resolveSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,         setTheme]         = useState<Theme>("light")
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null
    const initial: Theme = stored === "dark" || stored === "system" || stored === "light"
      ? stored
      : "light"
    const resolved = initial === "system" ? resolveSystem() : initial
    setTheme(initial)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  // Listen to system changes when in system mode
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => {
      const next = e.matches ? "dark" : "light"
      setResolvedTheme(next)
      applyTheme(next)
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  const updateTheme = (t: Theme) => {
    setTheme(t)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, t)
    }
    const resolved = t === "system" ? resolveSystem() : t
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme: updateTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider")
  return ctx
}
