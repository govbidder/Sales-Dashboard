import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { MetricsHubView } from "@/components/views/metrics-hub-view"

export const metadata = { title: "Métricas" }

export default function MetricsPage() {
  return (
    <DashboardLayout>
      <MetricsHubView />
    </DashboardLayout>
  )
}
