import { DashboardLayout }   from "@/components/layout/dashboard-layout"
import { BusinessKPIs }      from "@/components/sections/business-kpis"
import { Profitability }     from "@/components/sections/profitability"
import { MoMPanel }          from "@/components/sections/mom-panel"
import { Projections }       from "@/components/sections/projections"
import { CorrelationChart }  from "@/components/sections/correlation-chart"
import { TrendCharts }       from "@/components/sections/trend-charts"

export const metadata = { title: "Panel" }

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-14">
        {/* 1. Snapshot del mes — KPIs principales con sparklines */}
        <BusinessKPIs />

        {/* 2. Rentabilidad — beneficio, margen, breakdown de costos */}
        <Profitability />

        {/* 3. Proyecciones — forecast 3 meses + pace anual + YoY */}
        <Projections />

        {/* 4. Mes a mes — qué cambió vs el mes anterior */}
        <MoMPanel />

        {/* 5. Correlaciones — qué inputs movieron qué outputs */}
        <CorrelationChart />

        {/* 6. Histórico — tendencia 12 meses por métrica */}
        <TrendCharts />
      </div>
    </DashboardLayout>
  )
}
