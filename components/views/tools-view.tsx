"use client"

import { useState } from "react"
import {
  Wrench, ExternalLink, Calculator, FileText, Globe2, Building2,
  ShieldCheck, Search, BookOpen, Hammer, Star, ArrowRight,
} from "lucide-react"

// ─── External resources ──────────────────────────────────────────────────────

interface ResourceLink {
  name:    string
  url:     string
  desc:    string
  badge?:  string
}

const PORTALS: ResourceLink[] = [
  {
    name: "SAM.gov",
    url:  "https://sam.gov",
    desc: "Portal oficial de oportunidades federales (reemplazó a FBO).",
    badge: "Crítico",
  },
  {
    name: "USAspending.gov",
    url:  "https://www.usaspending.gov",
    desc: "Quién recibió contratos federales históricamente. Útil para research de competencia.",
  },
  {
    name: "FPDS-NG",
    url:  "https://www.fpds.gov",
    desc: "Federal Procurement Data System. Datos crudos de contratos adjudicados.",
  },
  {
    name: "GSA Advantage",
    url:  "https://www.gsaadvantage.gov",
    desc: "Catálogo GSA — productos y servicios pre-aprobados.",
  },
  {
    name: "DSBS (SBA)",
    url:  "https://web.sba.gov/pro-net/search/dsp_dsbs.cfm",
    desc: "Dynamic Small Business Search — directorio de small businesses.",
  },
  {
    name: "Acquisition.gov",
    url:  "https://www.acquisition.gov",
    desc: "Federal Acquisition Regulation (FAR). Texto oficial.",
  },
]

const STATE_PORTALS: ResourceLink[] = [
  { name: "Texas SmartBuy", url: "https://www.txsmartbuy.gov", desc: "Portal de licitaciones de Texas." },
  { name: "California eProcure", url: "https://caleprocure.ca.gov", desc: "Licitaciones del estado de California." },
  { name: "Florida MyFloridaMarketplace", url: "https://www.myfloridamarketplace.com", desc: "Portal estatal de Florida." },
  { name: "NY Open Procurement", url: "https://ogs.ny.gov/procurement", desc: "Office of General Services, NY." },
]

const REGISTRATIONS: ResourceLink[] = [
  { name: "SAM.gov Entity Registration", url: "https://sam.gov/content/entity-registration", desc: "UEI + SAM activo. Renovación anual." },
  { name: "DUNS / UEI Lookup", url: "https://sam.gov/content/duns-uei", desc: "Conseguir o validar Unique Entity ID." },
  { name: "SBA Certifications", url: "https://certify.sba.gov", desc: "8(a), HUBZone, WOSB, VOSB, SDVOSB." },
  { name: "GSA Schedule (MAS)", url: "https://www.gsa.gov/buying-selling/purchasing-programs/multiple-award-schedule", desc: "Multiple Award Schedule — pre-aprobación para venderle al gobierno." },
]

// ─── Bid Calculator State ────────────────────────────────────────────────────

function BidCalculator() {
  const [costs,    setCosts]    = useState("")
  const [overhead, setOverhead] = useState("15")
  const [profit,   setProfit]   = useState("10")
  const [contingency, setContingency] = useState("5")

  const c = Number(costs) || 0
  const oh = (Number(overhead) || 0) / 100
  const pr = (Number(profit) || 0) / 100
  const cg = (Number(contingency) || 0) / 100

  const overheadAmt    = c * oh
  const contingencyAmt = c * cg
  const subtotal       = c + overheadAmt + contingencyAmt
  const profitAmt      = subtotal * pr
  const total          = subtotal + profitAmt
  const markup         = c > 0 ? ((total - c) / c) * 100 : 0

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Costos directos" value={costs} onChange={setCosts} type="currency" placeholder="0" />
        <Field label="Overhead %"      value={overhead} onChange={setOverhead} type="percent" />
        <Field label="Contingencia %"  value={contingency} onChange={setContingency} type="percent" />
        <Field label="Profit %"        value={profit} onChange={setProfit} type="percent" />
      </div>

      <div className="rounded-2xl border border-[#1e3a8a]/20 bg-gradient-to-br from-[#1e3a8a]/[0.04] to-white p-5 space-y-3">
        <BreakdownRow label="Costos directos"  amount={fmt(c)} />
        <BreakdownRow label="+ Overhead"       amount={fmt(overheadAmt)} sub={`${overhead}%`} />
        <BreakdownRow label="+ Contingencia"   amount={fmt(contingencyAmt)} sub={`${contingency}%`} />
        <BreakdownRow label="Subtotal"         amount={fmt(subtotal)} bold />
        <BreakdownRow label="+ Profit"         amount={fmt(profitAmt)} sub={`${profit}%`} />
        <div className="border-t border-slate-200 pt-3 mt-2 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/70">Bid total</p>
            <p className="text-[28px] font-bold text-[#1e3a8a] tabular-nums leading-none">{fmt(total)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Markup</p>
            <p className="text-[16px] font-bold text-slate-700 tabular-nums">{markup.toFixed(1)}%</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, type, placeholder,
}: {
  label:       string
  value:       string
  onChange:    (v: string) => void
  type?:       "currency" | "percent"
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/70">
        {label}
      </label>
      <div className="relative">
        {type === "currency" && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">$</span>
        )}
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "0"}
          inputMode="decimal"
          className={`h-10 w-full rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 outline-none focus:border-[#1e3a8a]/40 focus:ring-2 focus:ring-[#1e3a8a]/10 transition-all ${
            type === "currency" ? "pl-7 pr-3" : type === "percent" ? "pl-3 pr-8" : "px-3"
          }`}
        />
        {type === "percent" && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">%</span>
        )}
      </div>
    </div>
  )
}

function BreakdownRow({
  label, amount, sub, bold,
}: { label: string; amount: string; sub?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-[12.5px] ${bold ? "font-bold text-slate-900" : "text-slate-600"}`}>
        {label}
        {sub && <span className="ml-1.5 text-[10.5px] text-slate-400">({sub})</span>}
      </span>
      <span className={`tabular-nums text-[13px] ${bold ? "font-bold text-slate-900" : "text-slate-700"}`}>
        {amount}
      </span>
    </div>
  )
}

// ─── Resource Card ───────────────────────────────────────────────────────────

function ResourceCard({ link }: { link: ResourceLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:border-[#1e3a8a]/30 hover:shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-200 group-hover:bg-[#1e3a8a]/[0.06] group-hover:ring-[#1e3a8a]/20 transition-all">
        <Globe2 className="h-4 w-4 text-slate-500 group-hover:text-[#1e3a8a] transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-bold text-slate-900 truncate">{link.name}</p>
          {link.badge && (
            <span className="rounded-full border border-[#E42D2C]/25 bg-[#E42D2C]/[0.08] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#E42D2C]">
              {link.badge}
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{link.desc}</p>
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-[#1e3a8a] transition-colors mt-1" />
    </a>
  )
}

// ─── Section helper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, subtitle, children,
}: {
  icon: any
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a8a]/[0.06] ring-1 ring-[#1e3a8a]/15">
          <Icon className="h-3.5 w-3.5 text-[#1e3a8a]" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-slate-900 leading-none">{title}</h2>
          {subtitle && <p className="text-[11.5px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function ToolsView() {
  return (
    <div className="space-y-8">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 sm:p-8" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 16px 40px -16px rgba(15,23,42,0.10)" }}>
        <div className="pointer-events-none absolute -top-32 -right-32 h-[400px] w-[400px] rounded-full bg-[#E42D2C]/[0.06] blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-[300px] w-[300px] rounded-full bg-[#1e3a8a]/[0.06] blur-[100px]" />

        <div className="relative flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#E42D2C]/10 to-[#1e3a8a]/10 ring-1 ring-[#1e3a8a]/15">
            <Wrench className="h-4 w-4 text-[#1e3a8a]" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#1e3a8a]">
            Herramientas
          </span>
        </div>

        <h1 className="relative text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900 leading-tight">
          Tu caja de herramientas para gov contracting.
        </h1>
        <p className="relative text-[13.5px] text-slate-500 mt-2 max-w-xl">
          Portales oficiales, registraciones obligatorias, calculadoras internas y plantillas. Todo a un click.
        </p>
      </div>

      {/* Quick actions — bid calculator */}
      <Section
        icon={Calculator}
        title="Bid calculator"
        subtitle="Estimación rápida con overhead, contingencia y profit."
      >
        <BidCalculator />
      </Section>

      {/* Federal portals */}
      <Section
        icon={Building2}
        title="Portales federales"
        subtitle="Los lugares clave donde se buscan oportunidades y se publican contratos."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {PORTALS.map(l => <ResourceCard key={l.url} link={l} />)}
        </div>
      </Section>

      {/* State portals */}
      <Section
        icon={Globe2}
        title="Portales estatales"
        subtitle="Algunos de los más activos. SmartBuy de Texas y California eProcure son los principales."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {STATE_PORTALS.map(l => <ResourceCard key={l.url} link={l} />)}
        </div>
      </Section>

      {/* Registrations */}
      <Section
        icon={ShieldCheck}
        title="Registraciones y certificaciones"
        subtitle="Sin SAM activo y UEI vigente, no hay bid posible. Renovaciones recomendadas anualmente."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {REGISTRATIONS.map(l => <ResourceCard key={l.url} link={l} />)}
        </div>
      </Section>

      {/* Internal docs (placeholder for future templates section) */}
      <Section
        icon={FileText}
        title="Plantillas internas"
        subtitle="Capability statements, propuestas técnicas, past performance. (Próximamente)"
      >
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-8 text-center">
          <BookOpen className="h-5 w-5 text-slate-400 mx-auto mb-2" />
          <p className="text-[13px] text-slate-500">
            Pronto: capability statement template, technical proposal skeleton, pricing matrix.
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Para empezar, subí los archivos en <span className="text-[#1e3a8a] font-semibold">Recursos</span>.
          </p>
        </div>
      </Section>
    </div>
  )
}
