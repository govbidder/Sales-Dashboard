import { createServiceClient } from "@/lib/supabase-service"

export async function getLatestResearchRequest({ userId }: { userId: string }) {
  const db = createServiceClient()
  const { data } = await db
    .from("research_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()
  return data ?? null
}

export async function getResearchHistory({ userId }: { userId: string }) {
  const db = createServiceClient()
  const { data } = await db
    .from("research_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20)
  return data ?? []
}

export async function getResearchResult(requestId: string) {
  const db = createServiceClient()
  const { data } = await db
    .from("research_results")
    .select("*")
    .eq("request_id", requestId)
    .single()
  return data ?? null
}
