import { createServiceClient } from "@/lib/supabase-service"

export async function getLatestAIDiagnosisRequest({ userId }: { userId: string }) {
  const db = createServiceClient()
  const { data } = await db
    .from("ai_diagnosis_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()
  return data ?? null
}

export async function getAIDiagnosisHistory({ userId }: { userId: string }) {
  const db = createServiceClient()
  const { data } = await db
    .from("ai_diagnosis_requests")
    .select("id, audit_type, selected_month, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20)
  return data ?? []
}

export async function getAIDiagnosisResult(requestId: string) {
  const db = createServiceClient()
  const { data } = await db
    .from("ai_diagnosis_results")
    .select("*")
    .eq("request_id", requestId)
    .single()
  return data ?? null
}
