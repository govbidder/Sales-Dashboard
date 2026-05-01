// ── STUB — no external connections ────────────────────────────────────────────
export interface ZapierResult { ok: boolean; error?: string }
export async function zapierReportCompleted(): Promise<ZapierResult> { return { ok: true } }
export async function zapierSaleRegistered(): Promise<ZapierResult> { return { ok: true } }
