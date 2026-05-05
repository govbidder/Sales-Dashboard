import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { SalesView } from "@/components/views/sales-view"

export const metadata = { title: "Ingresos" }

export default function SalesPage() {
  return (
    <DashboardLayout>
      <SalesView />
    </DashboardLayout>
  )
}
