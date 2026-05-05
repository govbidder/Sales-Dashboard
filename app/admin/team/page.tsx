import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { TeamView } from "@/components/views/team-view"

export const metadata = { title: "Equipo" }

export default function TeamPage() {
  return (
    <DashboardLayout>
      <TeamView />
    </DashboardLayout>
  )
}
