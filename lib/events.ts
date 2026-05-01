// ── STUB — no external connections ────────────────────────────────────────────
export type EventType = "monthly_report.completed" | "sale.registered" | "airtable.sync"
export interface EventPayload {}
export interface EnqueueEventOptions { type: EventType; payload?: any }
export async function enqueueEvent(): Promise<string> { return "mock-id" }
export async function enqueueEvents(): Promise<string[]> { return [] }
export async function fireEventDispatcher(): Promise<void> {}
