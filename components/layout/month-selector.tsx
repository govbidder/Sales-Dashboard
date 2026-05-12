"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function generateMonths(enabledMonths?: string[]) {
  const set = new Set<string>()
  set.add(currentMonthKey())

  const normalize = (s: any): string | null => {
    const str = String(s ?? "").trim()
    if (!str) return null

    const m1 = str.match(/^(\d{4})-(\d{2})/)
    if (m1) return `${m1[1]}-${m1[2]}`

    const m2 = str.match(/^(\d{4})-(\d{1,2})/)
    if (m2) return `${m2[1]}-${String(Number(m2[2])).padStart(2, "0")}`

    return null
  }

  if (Array.isArray(enabledMonths)) {
    for (const m of enabledMonths) {
      const norm = normalize(m)
      if (norm && /^\d{4}-\d{2}$/.test(norm)) set.add(norm)
    }
  }

  const sorted = Array.from(set).sort()
  return sorted.map((value) => ({ value, disabled: false }))
}

type MonthSelectorProps = {
  value?: string
  onChange?: (value: string) => void
  enabledMonths?: string[]
}

export function MonthSelector({ value, onChange, enabledMonths }: MonthSelectorProps) {
  const months = useMemo(() => generateMonths(enabledMonths), [enabledMonths])
  const defaultMonth = months.slice(-1)[0]?.value ?? currentMonthKey()

  const [selectedMonth, setSelectedMonth] = useState<string>(value ?? defaultMonth)

  useEffect(() => {
    if (typeof value === "string") setSelectedMonth(value)
  }, [value])

  return (
    <Select
      value={selectedMonth}
      onValueChange={(v) => {
        setSelectedMonth(v)
        onChange?.(v)
      }}
    >
      <SelectTrigger className="w-[110px] sm:w-[140px] text-xs sm:text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {months.map((m) => (
          <SelectItem
            key={m.value}
            value={m.value}
            disabled={m.disabled}
          >
            {m.value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
