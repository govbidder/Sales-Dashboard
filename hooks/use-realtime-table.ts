"use client"

/**
 * useRealtimeTable — suscripción a cambios de una tabla de Postgres
 * vía Supabase Realtime (Logical Replication + WebSockets).
 *
 * Reutilizable para tasks, personas, monthly_reports, etc. El consumidor
 * pasa callbacks para INSERT / UPDATE / DELETE y este hook se encarga de:
 *   - abrir el channel y subscribirse
 *   - mantener la sub activa con reconexión automática
 *   - limpiar al unmount
 *   - filtrar opcionalmente por columna (ej. client_id=eq.<uuid>)
 *
 * Pre-requisito en DB: la tabla debe estar en la publicación
 * `supabase_realtime` con `replica identity full`. Ver
 * supabase/migrations/20260513000001_enable_realtime.sql.
 *
 * No maneja conflictos optimistic-vs-server — eso es responsabilidad del
 * consumidor (que tiene la lógica de "qué cambió localmente").
 */

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"

type ChangeType = "INSERT" | "UPDATE" | "DELETE"

interface ChangePayload<Row> {
  eventType: ChangeType
  new:       Row | null
  old:       Row | null
}

interface Options<Row> {
  /** Nombre de la tabla en el schema `public`. */
  table:    string
  /** Filtro opcional estilo Supabase ("client_id=eq.abc-123"). */
  filter?:  string
  /** Llamado en INSERT / UPDATE / DELETE. Recibe el payload normalizado. */
  onChange: (payload: ChangePayload<Row>) => void
  /** Si false, no se suscribe (útil para esperar auth). Default true. */
  enabled?: boolean
}

export function useRealtimeTable<Row = any>({
  table, filter, onChange, enabled = true,
}: Options<Row>) {
  // Guardamos el callback en ref para que el subscribe no se re-ejecute
  // cada render por una nueva referencia de función.
  const cbRef = useRef(onChange)
  useEffect(() => { cbRef.current = onChange }, [onChange])

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    // Canal con nombre único por tabla+filtro para no chocar con otros
    // subscribers en la misma sesión.
    const channelName = `realtime:${table}${filter ? `:${filter}` : ""}`

    channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as any,
        {
          event:  "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: any) => {
          cbRef.current({
            eventType: payload.eventType,
            new:       payload.new ?? null,
            old:       payload.old ?? null,
          })
        }
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [table, filter, enabled])
}
