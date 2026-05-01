// ── STUB — no external connections ────────────────────────────────────────────
export interface AirtableResult { ok: boolean; record_id?: string; error?: string }
export function isAirtableConfigured(): boolean { return false }
export async function syncReportToAirtable(): Promise<AirtableResult> { return { ok: true } }
