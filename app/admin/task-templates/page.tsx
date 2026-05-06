import type { Metadata } from "next"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { TaskTemplatesAdminView } from "@/components/views/task-templates-admin-view"

export const metadata: Metadata = { title: "Templates de tareas" }

export default function TaskTemplatesAdminPage() {
  return (
    <DashboardLayout>
      <TaskTemplatesAdminView />
    </DashboardLayout>
  )
}
