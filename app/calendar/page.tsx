import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { CalendarView} from "@/components/views/calendar-view"

export const metadata = { title: "Agenda" }

export default function ToolsPage() {
  return (
    <DashboardLayout>
      <CalendarView />
    </DashboardLayout>
  )
}
