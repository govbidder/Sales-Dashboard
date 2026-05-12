"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

export interface MonthlyReport {
  month:               string
  cash_collected:      number
  total_revenue:       number
  mrr:                 number
  ad_spend:            number
  new_clients:         number
  scheduled_calls:     number
  attended_calls:      number
  cierres_por_offerdoc: number
  open_conversations:  number
  short_followers:     number
  short_posts:         number
  short_reach:         number
  yt_subscribers:      number
  yt_views:            number
  yt_videos:           number
  email_subscribers:   number
}

export function useMonthlyReports() {
  const [reports, setReports] = useState<MonthlyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        if (mounted) { setLoading(true); setError(null) }
        const supabase = createClient()
        const { data, error: err } = await supabase
          .from("monthly_reports")
          .select("*")
          .order("month", { ascending: true })

        if (err) throw err

        if (mounted) setReports(
          ((data ?? []) as any[]).map((r: any) => ({
            month:                String(r.month).slice(0, 7),
            cash_collected:       Number(r.cash_collected)       || 0,
            total_revenue:        Number(r.total_revenue)        || 0,
            mrr:                  Number(r.mrr)                  || 0,
            ad_spend:             Number(r.ad_spend)             || 0,
            new_clients:          Number(r.new_clients)          || 0,
            scheduled_calls:      Number(r.scheduled_calls)      || 0,
            attended_calls:       Number(r.attended_calls)       || 0,
            cierres_por_offerdoc: Number(r.cierres_por_offerdoc) || 0,
            open_conversations:   Number(r.open_conversations)   || 0,
            short_followers:      Number(r.short_followers)      || 0,
            short_posts:          Number(r.short_posts)          || 0,
            short_reach:          Number(r.short_reach)          || 0,
            yt_subscribers:       Number(r.yt_subscribers)       || 0,
            yt_views:             Number(r.yt_views)             || 0,
            yt_videos:            Number(r.yt_videos)            || 0,
            email_subscribers:    Number(r.email_subscribers)    || 0,
          }))
        )
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Error cargando reportes")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [])

  return { reports, loading, error }
}
