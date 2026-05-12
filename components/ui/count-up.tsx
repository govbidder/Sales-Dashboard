"use client"

/**
 * <CountUp value={N} /> — anima desde 0 hasta `value` cuando el componente
 * monta o cuando `value` cambia. Usa requestAnimationFrame con easing
 * cubic-out para una sensación premium.
 *
 * Render como <span> tabular-nums para que los dígitos no salten de ancho.
 */

import { useEffect, useRef, useState } from "react"

interface Props {
  value:    number
  /** Duración en ms. Default 900. */
  duration?: number
  /** Sufijo opcional (ej "%"). */
  suffix?:   string
  /** Prefijo opcional (ej "$"). */
  prefix?:   string
  /** Formatear con separador de miles. Default false. */
  format?:   boolean
  /** ClassName aplicada al <span>. */
  className?: string
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export function CountUp({
  value, duration = 900, suffix = "", prefix = "", format = false, className,
}: Props) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef<number | null>(null)
  const fromRef  = useRef<number>(0)
  const rafRef   = useRef<number | null>(null)

  useEffect(() => {
    fromRef.current = display
    startRef.current = null
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      const t = Math.min(1, elapsed / duration)
      const eased = easeOutCubic(t)
      const next = fromRef.current + (value - fromRef.current) * eased
      setDisplay(next)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  const rounded = Math.round(display)
  const formatted = format ? rounded.toLocaleString("es-AR") : String(rounded)

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}{formatted}{suffix}
    </span>
  )
}
