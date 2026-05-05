import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { PersonasAgendadasView } from "@/components/views/personas-agendadas-view"

export const metadata = { title: "Personas Agendadas" }

export default function PersonasPage() {
  return (
    <DashboardLayout>
      <PersonasAgendadasView />
    </DashboardLayout>
  )
}
