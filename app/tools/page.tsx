import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ToolsView} from "@/components/views/tools-view"

export const metadata = { title: "Herramientas" }

export default function ToolsPage() {
  return (
    <DashboardLayout>
      <ToolsView />
    </DashboardLayout>
  )
}
