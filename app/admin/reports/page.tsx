import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ReportsInputView } from "@/components/views/reports-input-view"

export const metadata = { title: "Cargar Métricas" }

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <ReportsInputView />
    </DashboardLayout>
  )
}
