"use client"

/**
 * InlineEdit — edición en línea de un valor de texto.
 *
 * Pattern Linear/Notion: la columna vertebral de un dashboard rápido.
 * Click en el valor → input → Enter para guardar → vuelve a display.
 * Esc para cancelar. Blur por defecto guarda (más permisivo).
 *
 * El componente NO maneja la persistencia: llama a `onSave(next)` con
 * el nuevo valor. El parent decide qué hacer (optimistic update, server
 * call, rollback, etc.). Si `onSave` devuelve `false` o throwea, se
 * revierte al valor original.
 *
 * No abre el edit si el usuario está seleccionando texto, arrastrando
 * la card, o presionando un modifier — para no romper drag&drop ni
 * selección normal.
 */

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react"
import { cn } from "@/lib/utils"

interface Props {
  value:    string
  onSave:   (next: string) => void | boolean | Promise<void | boolean>
  /** Placeholder cuando edita y el valor está vacío. */
  placeholder?: string
  /** Class del span de display (el modo idle). */
  displayClassName?: string
  /** Class del input. Si no se pasa, hereda displayClassName. */
  editClassName?:    string
  /** Si true, ENTER guarda y mantiene en edit (no cierra). Default false. */
  multiline?: boolean
  /** Si true, no se puede editar (read-only). */
  disabled?:  boolean
  /** Llamado cuando el componente entra en edit mode. Útil para frenar drag de la card. */
  onEditStart?: () => void
  /** Llamado cuando sale del edit mode (save o cancel). */
  onEditEnd?:   () => void
  /** ARIA label / título tooltip. */
  ariaLabel?: string
}

export function InlineEdit({
  value,
  onSave,
  placeholder    = "",
  displayClassName,
  editClassName,
  multiline      = false,
  disabled       = false,
  onEditStart,
  onEditEnd,
  ariaLabel,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  // Cuando el valor externo cambia (ej. realtime push), reflejarlo en el
  // draft local mientras NO estemos editando — si el user está typing,
  // su input gana.
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  // Auto-focus + selección al entrar en edit mode.
  useEffect(() => {
    if (!editing || !inputRef.current) return
    inputRef.current.focus()
    if ("select" in inputRef.current) inputRef.current.select()
  }, [editing])

  const start = (e: MouseEvent) => {
    if (disabled || editing) return
    // Solo arrancamos edit en click LIMPIO (sin modifiers — el user puede
    // querer Cmd+click para otra cosa, o estar seleccionando texto).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.stopPropagation() // No queremos que el click se propague al Link/Card.
    setDraft(value)
    setEditing(true)
    onEditStart?.()
  }

  const commit = async () => {
    const next = draft.trim()
    if (next === value.trim()) {
      // Sin cambios — solo cerramos.
      setEditing(false)
      onEditEnd?.()
      return
    }
    if (!next) {
      // No permitimos guardar vacío (un title vacío rompe la UX).
      setDraft(value)
      setEditing(false)
      onEditEnd?.()
      return
    }
    try {
      const result = await onSave(next)
      if (result === false) {
        // Parent rechazó el cambio — revertir.
        setDraft(value)
      }
    } catch {
      setDraft(value)
    }
    setEditing(false)
    onEditEnd?.()
  }

  const cancel = () => {
    setDraft(value)
    setEditing(false)
    onEditEnd?.()
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      cancel()
    } else if (e.key === "Enter" && !multiline) {
      e.preventDefault()
      e.stopPropagation()
      void commit()
    } else if (e.key === "Enter" && multiline && (e.metaKey || e.ctrlKey)) {
      // Cmd+Enter en multiline → guardar.
      e.preventDefault()
      void commit()
    }
  }

  if (editing) {
    const InputTag = multiline ? "textarea" : "input"
    return (
      <InputTag
        ref={inputRef as any}
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => void commit()}
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        aria-label={ariaLabel}
        rows={multiline ? 3 : undefined}
        className={cn(
          // Base sutil pero visible — bordeada y con bg subtle para diferenciar
          // del display mode. Sin perder la jerarquía tipográfica.
          "w-full bg-background border border-foreground/20 rounded-md",
          "px-1.5 py-0.5 outline-none ring-2 ring-[#1e3a8a]/20",
          "focus:border-[#1e3a8a]/40 focus:ring-[#1e3a8a]/30",
          multiline ? "resize-y min-h-[60px]" : "",
          editClassName ?? displayClassName,
        )}
      />
    )
  }

  return (
    <span
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? undefined : 0}
      aria-label={ariaLabel}
      onClick={start as any}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault()
          e.stopPropagation()
          setDraft(value)
          setEditing(true)
          onEditStart?.()
        }
      }}
      className={cn(
        "inline-block max-w-full",
        disabled ? "" : "cursor-text rounded-md px-1.5 py-0.5 -mx-1.5 -my-0.5 hover:bg-muted/60 transition-colors",
        displayClassName,
      )}
      title={disabled ? undefined : "Click para editar (Enter)"}
    >
      {value || <span className="text-muted-foreground italic">{placeholder || "—"}</span>}
    </span>
  )
}
