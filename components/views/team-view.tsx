"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Plus, X, RefreshCw, Mail, Users2, ChevronRight,
  Crown, Shield, ListTodo, Clock,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "activo" | "inactivo"
type Role   = "admin" | "user"

interface Member {
  id:               string
  email:            string | null
  full_name:        string | null
  role:             Role
  position:         string | null
  status:           Status
  started_at:       string | null
  avatar_url:       string | null
  notes:            string | null
  last_sign_in_at:  string | null
  created_at:       string
  personas_owned:   number
  tasks_assigned:   number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}
function initials(s: string | null) {
  if (!s) return "?"
  return s.split(/[\s@]/).map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
}

const inputCls = "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none transition-all"

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  member, onClose, onPatch, isAdmin,
}: {
  member: Member
  onClose: () => void
  onPatch: (id: string, updates: Partial<Member>) => void
  isAdmin: boolean
}) {
  const displayName = member.full_name || member.email || "Sin nombre"

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[460px] flex-col border-l border-white/[0.08] shadow-2xl" style={{ backgroundColor: "#0d1745" }}>

        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E42D2C]/40 to-[#152978] font-bold text-white">
              {initials(displayName)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{displayName}</h2>
              <p className="text-[12px] text-white/35 truncate">{member.email ?? "Sin email"}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/35">
                <Users2 className="h-3 w-3" /> Personas
              </div>
              <p className="mt-1 text-2xl font-bold text-white tabular-nums">{member.personas_owned}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/35">
                <ListTodo className="h-3 w-3" /> Tareas
              </div>
              <p className="mt-1 text-2xl font-bold text-white tabular-nums">{member.tasks_assigned}</p>
            </div>
          </div>

          {/* Last sign in */}
          {member.last_sign_in_at && (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <Clock className="h-3.5 w-3.5 text-white/30" />
              <span className="text-[12px] text-white/55">
                Último acceso: <span className="text-white/85">{fmtDate(member.last_sign_in_at)}</span>
              </span>
            </div>
          )}

          {/* Editable fields (admin only) */}
          <fieldset disabled={!isAdmin} className="space-y-4 disabled:opacity-60">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Nombre completo</p>
              <input
                type="text"
                defaultValue={member.full_name ?? ""}
                placeholder="Nombre y apellido"
                onBlur={e => onPatch(member.id, { full_name: e.target.value || null })}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Rol</p>
                <select
                  defaultValue={member.role}
                  onChange={e => onPatch(member.id, { role: e.target.value as Role })}
                  className={inputCls}
                >
                  <option value="user"  className="bg-[#0d1745]">Miembro</option>
                  <option value="admin" className="bg-[#0d1745]">Admin</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Estado</p>
                <select
                  defaultValue={member.status}
                  onChange={e => onPatch(member.id, { status: e.target.value as Status })}
                  className={inputCls}
                >
                  <option value="activo"   className="bg-[#0d1745]">Activo</option>
                  <option value="inactivo" className="bg-[#0d1745]">Inactivo</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Posición / Cargo</p>
              <input
                type="text"
                defaultValue={member.position ?? ""}
                placeholder="ej: Owner, Director, Sales..."
                onBlur={e => onPatch(member.id, { position: e.target.value || null })}
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Empezó el</p>
              <input
                type="date"
                defaultValue={member.started_at ?? ""}
                onBlur={e => onPatch(member.id, { started_at: e.target.value || null })}
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Notas</p>
              <textarea
                defaultValue={member.notes ?? ""}
                placeholder="Contexto, especialidad, etc."
                rows={4}
                onBlur={e => onPatch(member.id, { notes: e.target.value || null })}
                className={`${inputCls} resize-none`}
              />
            </div>
          </fieldset>

          {!isAdmin && (
            <p className="text-[11px] text-white/35 italic text-center">
              Solo los admins pueden editar miembros del equipo.
            </p>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({
  onClose, onInvite, inviting,
}: {
  onClose:  () => void
  onInvite: (data: { email: string; full_name: string; position: string; role: Role }) => Promise<{ error?: string }>
  inviting: boolean
}) {
  const [email,    setEmail]    = useState("")
  const [fullName, setFullName] = useState("")
  const [position, setPosition] = useState("")
  const [role,     setRole]     = useState<Role>("user")
  const [error,    setError]    = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    const result = await onInvite({ email: email.trim(), full_name: fullName.trim(), position: position.trim(), role })
    if (result.error) setError(result.error)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-2xl border border-white/[0.10] shadow-2xl p-6 space-y-3.5 max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: "#0d1745" }}
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-white">Invitar al equipo</h3>
            <button type="button" onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-[12px] text-white/45">
            Le mandamos un email con link de invitación. Cuando acepte, se crea su cuenta y aparece acá.
          </p>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Email *</p>
            <input autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="persona@empresa.com" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Nombre</p>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nombre y apellido" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Posición</p>
              <input type="text" value={position} onChange={e => setPosition(e.target.value)} placeholder="ej: Director" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Rol</p>
              <select value={role} onChange={e => setRole(e.target.value as Role)} className={inputCls}>
                <option value="user"  className="bg-[#0d1745]">Miembro</option>
                <option value="admin" className="bg-[#0d1745]">Admin</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!email.trim() || inviting}
            className="w-full h-10 rounded-xl bg-[#E42D2C] text-white text-[13px] font-bold hover:bg-[#c42423] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Enviar invitación
          </button>
        </form>
      </div>
    </>
  )
}

// ─── Member Card ──────────────────────────────────────────────────────────────

function MemberCard({ member, onClick }: { member: Member; onClick: () => void }) {
  const displayName = member.full_name || member.email || "Sin nombre"
  const isAdmin = member.role === "admin"
  const isInactive = member.status === "inactivo"

  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border bg-[#0d1745] text-left transition-all p-5 ${
        isInactive
          ? "border-white/[0.04] opacity-60 hover:opacity-90"
          : "border-white/[0.07] hover:border-white/[0.18] hover:shadow-[0_0_30px_rgba(228,45,44,0.06)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E42D2C]/40 to-[#152978] font-bold text-white shadow-lg">
          {initials(displayName)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-white truncate">{displayName}</h3>
            {isAdmin && <Crown className="h-3 w-3 text-amber-400 shrink-0" />}
          </div>
          {member.position && (
            <p className="text-[12px] text-white/55 truncate">{member.position}</p>
          )}
          <p className="text-[11px] text-white/30 truncate mt-0.5">{member.email}</p>
        </div>

        <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/60 transition-colors shrink-0" />
      </div>

      {/* Status pills + counts */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isInactive ? (
            <span className="rounded-full border border-zinc-500/25 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-300">
              Inactivo
            </span>
          ) : (
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
              Activo
            </span>
          )}
          {isAdmin && (
            <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
              Admin
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-white/45">
          <span className="flex items-center gap-1" title="Personas agendadas a su cargo">
            <Users2 className="h-3 w-3" /> {member.personas_owned}
          </span>
          <span className="flex items-center gap-1" title="Tareas asignadas">
            <ListTodo className="h-3 w-3" /> {member.tasks_assigned}
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function TeamView() {
  const [members,        setMembers]        = useState<Member[]>([])
  const [loading,        setLoading]        = useState(true)
  const [selected,       setSelected]       = useState<Member | null>(null)
  const [showInvite,     setShowInvite]     = useState(false)
  const [inviting,       setInviting]       = useState(false)
  const [search,         setSearch]         = useState("")
  const [filterStatus,   setFilterStatus]   = useState<"todos" | Status>("todos")
  const [currentRole,    setCurrentRole]    = useState<Role>("user")

  const getSession = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }

  const fetchTeam = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      const supabase = createClient()
      // Get caller role from profiles
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", session.user.id).single()
      setCurrentRole((profile?.role as Role) ?? "user")

      const res = await fetch("/api/admin/team", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) setMembers((await res.json()).members ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTeam() }, [fetchTeam])

  const handleInvite = async (data: { email: string; full_name: string; position: string; role: Role }) => {
    setInviting(true)
    try {
      const session = await getSession()
      if (!session) return { error: "Sin sesión" }
      const res = await fetch("/api/admin/team/invite", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) return { error: json?.error ?? "Error invitando" }
      setShowInvite(false)
      setTimeout(fetchTeam, 500)
      return {}
    } finally { setInviting(false) }
  }

  const patch = async (id: string, updates: Partial<Member>) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...updates } : prev)
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/team", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id, ...updates }),
    })
  }

  const filtered = useMemo(() => members.filter(m => {
    if (filterStatus !== "todos" && m.status !== filterStatus) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [m.full_name, m.email, m.position].some(v => v?.toLowerCase().includes(q))
  }), [members, search, filterStatus])

  const isAdmin = currentRole === "admin"
  const activeCount = members.filter(m => m.status === "activo").length

  return (
    <>
      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} onInvite={handleInvite} inviting={inviting} />
      )}

      {selected && (
        <DetailDrawer
          member={selected}
          onClose={() => setSelected(null)}
          onPatch={patch}
          isAdmin={isAdmin}
        />
      )}

      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Equipo</h1>
            <p className="text-sm text-white/40 mt-0.5">
              {activeCount} {activeCount === 1 ? "miembro activo" : "miembros activos"}
              {members.length > activeCount && ` · ${members.length - activeCount} inactivo(s)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchTeam} disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-2 h-9 rounded-xl bg-[#E42D2C] px-4 text-sm font-bold text-white hover:bg-[#c42423] transition-all">
                <Plus className="h-3.5 w-3.5" />
                Invitar
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, posición..."
            className="h-9 rounded-xl border border-white/[0.08] bg-[#1c1c1f] px-4 text-sm text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none flex-1 min-w-[220px] max-w-sm"
          />
          <div className="flex items-center gap-1.5">
            {(["todos", "activo", "inactivo"] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`h-8 rounded-xl border px-3 text-[12px] font-medium transition-all capitalize ${
                  filterStatus === s
                    ? "border-[#E42D2C]/40 bg-[#E42D2C]/10 text-[#E42D2C]"
                    : "border-white/[0.07] text-white/40 hover:text-white hover:border-white/20"
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-[#0d1745] py-16">
            <Shield className="h-8 w-8 text-white/20 mb-3" />
            <p className="text-sm text-white/35">
              {members.length === 0 ? "Todavía no hay miembros del equipo." : "No hay coincidencias."}
            </p>
            {isAdmin && members.length === 0 && (
              <button
                onClick={() => setShowInvite(true)}
                className="mt-4 flex items-center gap-2 h-9 rounded-xl bg-[#E42D2C] px-4 text-sm font-bold text-white hover:bg-[#c42423] transition-all">
                <Plus className="h-3.5 w-3.5" />
                Invitar al primer miembro
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(m => (
              <MemberCard key={m.id} member={m} onClick={() => setSelected(m)} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
