import type { Metadata } from "next"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { DepartmentDashboardView } from "@/components/views/department-dashboard-view"

export const metadata: Metadata = { title: "Departamento" }

export default async function DepartmentDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <DashboardLayout>
      <DepartmentDashboardView departmentId={id} />
    </DashboardLayout>
  )
}
