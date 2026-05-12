import type { Metadata } from "next"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { DepartmentsView } from "@/components/views/departments-view"

export const metadata: Metadata = { title: "Departamentos" }

export default function DepartmentsPage() {
  return (
    <DashboardLayout>
      <DepartmentsView />
    </DashboardLayout>
  )
}
