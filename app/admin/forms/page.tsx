import type { Metadata } from "next"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { FormsAdminView } from "@/components/views/forms-admin-view"

export const metadata: Metadata = { title: "Forms" }

export default function FormsAdminPage() {
  return (
    <DashboardLayout>
      <FormsAdminView />
    </DashboardLayout>
  )
}
