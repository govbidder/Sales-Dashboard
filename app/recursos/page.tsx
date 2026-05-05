import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ResourcesView } from "@/components/views/resources-view"

export const metadata = { title: "Recursos" }

export default function RecursosPage() {
  return (
    <DashboardLayout>
      <ResourcesView />
    </DashboardLayout>
  )
}
