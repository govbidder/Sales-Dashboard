// ── STUB — no external connections ────────────────────────────────────────────
export interface SlackResult { ok: boolean; error?: string }
export async function sendSlackMessage(): Promise<SlackResult> { return { ok: true } }
export async function notifyMonthlyReportCompleted(): Promise<SlackResult> { return { ok: true } }
export async function notifySaleRegistered(): Promise<SlackResult> { return { ok: true } }
