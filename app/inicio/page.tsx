import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { InicioView } from "@/components/views/inicio-view"

export const metadata = { title: "Página Principal" }

export default function InicioPage() {
  return (
    <DashboardLayout>
      <InicioView />
    </DashboardLayout>
  )
}
