import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { PersonasAgendadasView } from "@/components/views/personas-agendadas-view"

export default function PersonasPage() {
  return (
    <DashboardLayout>
      <PersonasAgendadasView />
    </DashboardLayout>
  )
}
