import type { Metadata } from "next"
import { CrmPortalView } from "@/components/views/crm-portal-view"

export const metadata: Metadata = {
  title: "CRM",
  description: "GovBidder CRM — clientes activos, conversaciones, pipeline.",
}

export default function CrmPage() {
  return <CrmPortalView />
}
