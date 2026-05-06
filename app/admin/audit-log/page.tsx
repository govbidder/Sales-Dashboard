import type { Metadata } from "next"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AuditLogView } from "@/components/views/audit-log-view"

export const metadata: Metadata = { title: "Audit log" }

export default function AuditLogPage() {
  return (
    <DashboardLayout>
      <AuditLogView />
    </DashboardLayout>
  )
}
