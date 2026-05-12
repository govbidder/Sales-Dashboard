import { cn } from "@/lib/utils"

export function Sk({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />
}

/** KPI card skeleton — matches BusinessKPIs card exactly */
export function KpiCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <div className="h-[2px] w-full skeleton" />
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <Sk className="h-9 w-9 rounded-xl" />
          <Sk className="h-6 w-14 rounded-full" />
        </div>
        <Sk className="h-2.5 w-24 mb-3" />
        <Sk className="h-8 w-28" />
        <Sk className="h-2 w-32 mt-3" />
      </div>
    </div>
  )
}

/** Generic stat card — matches StatCard in SalesView / ChannelsView */
export function StatCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
      <Sk className="h-2.5 w-24 mb-3" />
      <Sk className="h-8 w-20" />
      <Sk className="h-2 w-28 mt-2" />
    </div>
  )
}

/** Funnel row skeleton — matches SalesView funnel steps */
export function FunnelRowSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Sk className="h-2.5 w-32" />
          <Sk className="h-8 w-12" />
        </div>
        <Sk className="h-7 w-14 rounded-full" />
      </div>
    </div>
  )
}

/** Channel block skeleton */
export function ChannelBlockSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="h-[2px] w-full skeleton" />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sk className="h-8 w-8 rounded-lg" />
          <Sk className="h-3 w-28" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <Sk className="h-2.5 w-28" />
            <Sk className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Reflection card skeleton */
export function ReflectionCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <Sk className="h-10 w-10 rounded-full" />
        <Sk className="h-3 w-36" />
      </div>
      <Sk className="h-3 w-full mb-2" />
      <Sk className="h-3 w-4/5 mb-2" />
      <Sk className="h-3 w-3/5" />
    </div>
  )
}

/** Section header skeleton */
export function SectionHeaderSkeleton() {
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <div className="h-4 w-[3px] rounded-full bg-[#1e3a8a]/30" />
      <Sk className="h-2.5 w-40" />
    </div>
  )
}

/** Task card skeleton — espejea TaskCard del kanban. */
export function TaskCardSkeleton({ withDescription = false }: { withDescription?: boolean } = {}) {
  return (
    <div className="relative rounded-xl border border-border bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-2 mb-2">
        <Sk className="h-3.5 w-3.5 rounded-full shrink-0 mt-0.5" />
        <Sk className="h-3 flex-1" />
      </div>
      {withDescription && <Sk className="h-2.5 w-4/5 mb-2" />}
      <div className="flex items-center gap-1.5 flex-wrap mt-2">
        <Sk className="h-5 w-14 rounded-full" />
        <Sk className="h-5 w-10 rounded-full" />
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <Sk className="h-2.5 w-20" />
        <Sk className="h-5 w-5 rounded-full" />
      </div>
    </div>
  )
}

/** Kanban board skeleton — espejea /admin/tasks board view.
 *  4 columnas, cada una con 2-3 task cards. */
export function KanbanBoardSkeleton() {
  // Distribución natural (más cards en pendiente, menos en completada).
  const layout: number[] = [3, 2, 2, 1]
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
      {layout.map((count, i) => (
        <div key={i} className="rounded-2xl border border-border bg-muted/30 p-2.5 min-h-[300px]">
          {/* Column header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Sk className="h-2 w-2 rounded-full" />
              <Sk className="h-2.5 w-20" />
            </div>
            <Sk className="h-4 w-6 rounded-full" />
          </div>
          {/* Cards */}
          <div className="space-y-2">
            {Array.from({ length: count }).map((_, j) => (
              <TaskCardSkeleton key={j} withDescription={j === 0} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Table row skeleton — fila genérica para tablas con avatar/nombre/email/estado.
 *  Usado por /admin/personas y /admin/team. */
export function TableRowSkeleton({ columns = 5 }: { columns?: number } = {}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-b-0">
      <Sk className="h-9 w-9 rounded-xl shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Sk className="h-3 w-1/3" />
        <Sk className="h-2.5 w-2/5" />
      </div>
      {Array.from({ length: Math.max(0, columns - 2) }).map((_, i) => (
        <Sk
          key={i}
          className={`h-5 ${i % 2 === 0 ? "w-16" : "w-20"} rounded-full hidden lg:block`}
        />
      ))}
      <Sk className="h-3.5 w-3.5 rounded shrink-0" />
    </div>
  )
}

/** Table skeleton — header + N rows. Espejea /admin/personas tabla. */
export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number } = {}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/30">
        <Sk className="h-2.5 w-24" />
        <div className="flex-1" />
        {Array.from({ length: Math.max(0, columns - 2) }).map((_, i) => (
          <Sk key={i} className="h-2.5 w-16 hidden lg:block" />
        ))}
      </div>
      {/* Rows */}
      <div>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} columns={columns} />
        ))}
      </div>
    </div>
  )
}

/** Inicio skeleton — espejea el nuevo home (status line + 3 critical cards + dept list).
 *  Mantiene la misma altura visual que el contenido real para evitar layout shift. */
export function InicioSkeleton({ deptCount = 5 }: { deptCount?: number } = {}) {
  return (
    <div className="space-y-5">
      {/* Status line hero */}
      <div className="rounded-2xl border border-border bg-card px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center gap-4 sm:gap-6">
          <Sk className="h-10 w-10 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Sk className="h-2 w-32" />
            <Sk className="h-4 w-3/4" />
          </div>
          <div className="hidden sm:flex flex-col items-center gap-1.5 border-l border-border pl-5 shrink-0">
            <Sk className="h-7 w-12" />
            <Sk className="h-1.5 w-10" />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Sk className="h-7 w-32 rounded-full" />
          <Sk className="h-7 w-24 rounded-full" />
        </div>
      </div>

      {/* 3 critical cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between mb-4">
              <Sk className="h-9 w-9 rounded-xl" />
              <Sk className="h-3 w-3 rounded" />
            </div>
            <Sk className="h-2 w-28 mb-2" />
            <Sk className="h-10 w-20 mb-3" />
            <Sk className="h-2.5 w-4/5 mb-1" />
            <Sk className="h-2.5 w-2/5" />
          </div>
        ))}
      </div>

      {/* Dept list */}
      <div>
        <div className="flex items-center gap-2 mb-2 px-1">
          <Sk className="h-3 w-3 rounded" />
          <Sk className="h-2.5 w-32" />
        </div>
        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          {Array.from({ length: deptCount }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <Sk className="h-3 w-3 rounded-full shrink-0" />
              <Sk className="h-3 flex-1 max-w-[180px]" />
              <Sk className="h-2.5 w-20 hidden sm:block" />
              <Sk className="h-5 w-20 rounded-full" />
              <Sk className="h-3.5 w-3.5 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
