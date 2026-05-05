import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { TasksView } from "@/components/views/tasks-view"

export const metadata = { title: "Tareas" }

export default function TasksPage() {
  return (
    <DashboardLayout>
      <TasksView />
    </DashboardLayout>
  )
}
