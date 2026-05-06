import type { Metadata } from "next"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ActivityView } from "@/components/views/activity-view"

export const metadata: Metadata = { title: "Actividad" }

export default function ActivityPage() {
  return (
    <DashboardLayout>
      <ActivityView />
    </DashboardLayout>
  )
}
