"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Plus, X, RefreshCw, Mail, Users2, ChevronRight,
  Crown, Shield, ListTodo, Clock, UserPlus, CheckCircle2, Sparkles,
} from "lucide-react"
import { Portal } from "@/components/ui/portal"
import type { Department } from "@/lib/types/department"
import {
  type Role,
  ROLE_LABEL,
  ROLES_ASSIGNABLE_BY_ADMIN,
  ROLES_ASSIGNABLE_BY_SUPER_ADMIN,
  isAdminOrAbove,
  isSuperAdminOrAbove,
  isDeveloper,
} from "@/lib/types/role"

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "activo" | "inactivo"

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
  department_id:    string | null
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

const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a]/40 focus:outline-none transition-all"

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  member, departments, onClose, onPatch, isAdmin, isSuper,
}: {
  member: Member
  departments: Department[]
  onClose: () => void
  onPatch: (id: string, updates: Partial<Member>) => void
  isAdmin: boolean
  isSuper: boolean
}) {
  const displayName = member.full_name || member.email || "Sin nombre"
  const roleOptions = isSuper ? ROLES_ASSIGNABLE_BY_SUPER_ADMIN : ROLES_ASSIGNABLE_BY_ADMIN

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/30" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-[110] flex w-full max-w-[460px] flex-col border-l border-slate-200 shadow-2xl" style={{ backgroundColor: "#ffffff" }}>

        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E42D2C]/40 to-[#152978] font-bold text-white">
              {initials(displayName)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 truncate">{displayName}</h2>
              <p className="text-[12px] text-slate-400 truncate">{member.email ?? "Sin email"}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">
                <Users2 className="h-3 w-3" /> Personas
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{member.personas_owned}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">
                <ListTodo className="h-3 w-3" /> Tareas
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{member.tasks_assigned}</p>
            </div>
          </div>

          {/* Last sign in */}
          {member.last_sign_in_at && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[12px] text-slate-500">
                Último acceso: <span className="text-slate-800">{fmtDate(member.last_sign_in_at)}</span>
              </span>
            </div>
          )}

          {/* Editable fields (admin only) */}
          <fieldset disabled={!isAdmin} className="space-y-4 disabled:opacity-60">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Nombre completo</p>
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Rol</p>
                <select
                  defaultValue={member.role}
                  onChange={e => onPatch(member.id, { role: e.target.value as Role })}
                  className={inputCls}
                  disabled={
                    member.role === "developer" ||
                    (member.role === "super_admin" && !isSuper)
                  }
                >
                  {/* Developer: nadie puede modificarlo desde la UI (solo via script). */}
                  {member.role === "developer" ? (
                    <option value="developer" className="bg-white">{ROLE_LABEL.developer}</option>
                  ) : member.role === "super_admin" && !isSuper ? (
                    /* Super_admin solo lo modifica super_admin o developer. */
                    <option value="super_admin" className="bg-white">{ROLE_LABEL.super_admin}</option>
                  ) : (
                    roleOptions.map(r => (
                      <option key={r} value={r} className="bg-white">{ROLE_LABEL[r]}</option>
                    ))
                  )}
                </select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Estado</p>
                <select
                  defaultValue={member.status}
                  onChange={e => onPatch(member.id, { status: e.target.value as Status })}
                  className={inputCls}
                >
                  <option value="activo"   className="bg-white">Activo</option>
                  <option value="inactivo" className="bg-white">Inactivo</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Posición / Cargo</p>
              <input
                type="text"
                defaultValue={member.position ?? ""}
                placeholder="ej: Owner, Director, Sales..."
                onBlur={e => onPatch(member.id, { position: e.target.value || null })}
                className={inputCls}
              />
            </div>

            {departments.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Departamento</p>
                <select
                  value={member.department_id ?? ""}
                  onChange={e => onPatch(member.id, { department_id: e.target.value || null })}
                  className={inputCls}
                >
                  <option value="">— Sin departamento —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Empezó el</p>
              <input
                type="date"
                defaultValue={member.started_at ?? ""}
                onBlur={e => onPatch(member.id, { started_at: e.target.value || null })}
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/60">Notas</p>
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
            <p className="text-[11px] text-slate-400 italic text-center">
              Solo los admins pueden editar miembros del equipo.
            </p>
          )}
        </div>
      </div>
    </Portal>
  )
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({
  onClose, onInvite, inviting, departments, isSuper,
}: {
  onClose:  () => void
  onInvite: (data: { email: string; full_name: string; position: string; role: Role; department_id: string | null }) => Promise<{ error?: string }>
  inviting: boolean
  departments: Department[]
  isSuper: boolean
}) {
  const roleOptions = isSuper ? ROLES_ASSIGNABLE_BY_SUPER_ADMIN : ROLES_ASSIGNABLE_BY_ADMIN
  const [email,        setEmail]        = useState("")
  const [fullName,     setFullName]     = useState("")
  const [position,     setPosition]     = useState("")
  const [role,         setRole]         = useState<Role>("user")
  const [departmentId, setDepartmentId] = useState("")
  const [error,        setError]        = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    const result = await onInvite({ email: email.trim(), full_name: fullName.trim(), position: position.trim(), role, department_id: departmentId || null })
    if (result.error) setError(result.error)
  }

  const canSubmit = email.trim().length > 0 && !inviting

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-md" onClick={onClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="relative w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden rounded-3xl border border-slate-200 shadow-[0_30px_80px_rgba(15,23,42,0.20)] page-enter"
          style={{ backgroundColor: "#ffffff" }}
        >
          {/* Ambient glow */}
          <div className="pointer-events-none absolute -top-32 -right-32 h-[300px] w-[300px] rounded-full bg-[#E42D2C]/[0.08] blur-[80px]" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 h-[260px] w-[260px] rounded-full bg-slate-100/40 blur-[80px]" />

          {/* Header with icon */}
          <div className="relative shrink-0 px-6 pt-6 pb-5 border-b border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6b6a] to-[#c42423] shadow-[0_0_24px_rgba(228,45,44,0.30)]">
                <UserPlus className="h-5 w-5 text-slate-900" />
              </span>
              <div className="pt-1">
                <h3 className="text-[18px] font-bold tracking-tight text-slate-900 leading-none">
                  Invitar al equipo
                </h3>
                <p className="mt-2 text-[12px] text-slate-500 leading-relaxed pr-8">
                  Le mandamos un email con link de invitación. Cuando acepte, se crea su cuenta y aparece acá.
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="relative flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">Email *</p>
              <input
                autoFocus type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="persona@empresa.com"
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">Nombre</p>
              <input
                type="text" value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Nombre y apellido"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">Posición</p>
                <input
                  type="text" value={position}
                  onChange={e => setPosition(e.target.value)}
                  placeholder="ej: Director"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">Rol</p>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as Role)}
                  className={inputCls + " cursor-pointer"}
                >
                  {roleOptions.map(r => (
                    <option key={r} value={r} className="bg-white">{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </div>
            </div>

            {departments.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]/80">Departamento</p>
                <select
                  value={departmentId}
                  onChange={e => setDepartmentId(e.target.value)}
                  className={inputCls + " cursor-pointer"}
                >
                  <option value="">— Sin departamento —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-700">
                <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Footer with action */}
          <div className="relative shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              type="submit"
              disabled={!canSubmit}
              className="group flex w-full items-center justify-center gap-2 h-11 rounded-xl bg-[#E42D2C] text-[13px] font-bold text-slate-900 shadow-[0_8px_24px_rgba(228,45,44,0.25)] hover:bg-[#c42423] hover:shadow-[0_12px_32px_rgba(228,45,44,0.40)] transition-all disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {inviting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" />
                  Enviar invitación
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Portal>
  )
}

// ─── Member Card ──────────────────────────────────────────────────────────────

function MemberCard({ member, department, onClick }: { member: Member; department: Department | null; onClick: () => void }) {
  const displayName = member.full_name || member.email || "Sin nombre"
  const isAdmin   = isAdminOrAbove(member.role)
  const isDev     = isDeveloper(member.role)
  const isSuper   = member.role === "super_admin"
  const isInactive = member.status === "inactivo"

  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border bg-white text-left transition-all p-5 ${
        isInactive
          ? "border-slate-100 opacity-60 hover:opacity-90"
          : "border-slate-200 hover:border-slate-300 hover:shadow-[0_0_30px_rgba(228,45,44,0.06)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E42D2C]/40 to-[#152978] font-bold text-white shadow-lg">
          {initials(displayName)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-slate-900 truncate">{displayName}</h3>
            {isDev
              ? <Sparkles className="h-3 w-3 text-cyan-600 shrink-0" />
              : isAdmin && <Crown className="h-3 w-3 text-amber-600 shrink-0" />}
          </div>
          {member.position && (
            <p className="text-[12px] text-slate-500 truncate">{member.position}</p>
          )}
          <p className="text-[11px] text-slate-400 truncate mt-0.5">{member.email}</p>
        </div>

        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
      </div>

      {/* Status pills + counts */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isInactive ? (
            <span className="rounded-full border border-zinc-500/25 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-700">
              Inactivo
            </span>
          ) : (
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              Activo
            </span>
          )}
          {isAdmin && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              isDev
                ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-700"
                : isSuper
                ? "border-purple-400/30 bg-purple-400/10 text-purple-700"
                : "border-amber-400/25 bg-amber-400/10 text-amber-700"
            }`}>
              {isDev ? "Developer" : isSuper ? "Super admin" : "Admin"}
            </span>
          )}
          {department && (
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-bold"
              style={{ borderColor: department.color + "40", backgroundColor: department.color + "15", color: department.color }}
            >
              {department.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500">
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
  const [departments,    setDepartments]    = useState<Department[]>([])
  const [filterDepartment, setFilterDepartment] = useState<string>("todos")

  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

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

      const [res, dRes] = await Promise.all([
        fetch("/api/admin/team",  { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch("/api/departments", { headers: { Authorization: `Bearer ${session.access_token}` } }),
      ])
      if (res.ok) setMembers((await res.json()).members ?? [])
      if (dRes.ok) setDepartments((await dRes.json()).departments ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTeam() }, [fetchTeam])

  // Quick-action: open "Invitar al equipo" modal when ?invite=1 and the current user is admin.
  // We only act once the role has been resolved by fetchTeam — non-admins ignore the param.
  useEffect(() => {
    if (searchParams?.get("invite") !== "1") return
    if (loading) return
    if (isAdminOrAbove(currentRole)) setShowInvite(true)
    router.replace(pathname, { scroll: false })
  }, [searchParams, loading, currentRole, router, pathname])

  const handleInvite = async (data: { email: string; full_name: string; position: string; role: Role; department_id: string | null }) => {
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

  const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments])

  const filtered = useMemo(() => members.filter(m => {
    if (filterStatus !== "todos" && m.status !== filterStatus) return false
    if (filterDepartment !== "todos" && m.department_id !== filterDepartment) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [m.full_name, m.email, m.position].some(v => v?.toLowerCase().includes(q))
  }), [members, search, filterStatus, filterDepartment])

  const isAdmin       = isAdminOrAbove(currentRole)
  // Variable se llama `isSuper` por compat — semánticamente es "super_admin o
  // por encima" (incluye developer). Developer pasa todos los gates de super.
  const isSuper       = isSuperAdminOrAbove(currentRole)
  const activeCount   = members.filter(m => m.status === "activo").length
  const inactiveCount = members.length - activeCount
  const adminCount    = members.filter(m => isAdminOrAbove(m.role)).length
  const totalPersonas = members.reduce((s, m) => s + (m.personas_owned ?? 0), 0)
  const totalTasks    = members.reduce((s, m) => s + (m.tasks_assigned ?? 0), 0)

  return (
    <>
      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} onInvite={handleInvite} inviting={inviting} departments={departments} isSuper={isSuper} />
      )}

      {selected && (
        <DetailDrawer
          member={selected}
          departments={departments}
          onClose={() => setSelected(null)}
          onPatch={patch}
          isAdmin={isAdmin}
          isSuper={isSuper}
        />
      )}

      <div className="space-y-6">

        {/* HERO ───────────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 -right-32 h-[400px] w-[400px] rounded-full bg-[#E42D2C]/[0.08] blur-[100px]" />
            <div className="absolute -bottom-24 -left-24 h-[300px] w-[300px] rounded-full bg-slate-100/40 blur-[100px]" />
          </div>

          <div className="relative grid lg:grid-cols-[1fr_auto] gap-4 p-6 sm:p-7 items-end">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E42D2C]/15 ring-1 ring-[#E42D2C]/30">
                  <Users2 className="h-3.5 w-3.5 text-[#ff6b6a]" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#1e3a8a]">
                  Equipo
                </span>
              </div>
              <h1 className="text-[32px] sm:text-[40px] font-bold tracking-tight text-slate-900 leading-[1.05]">
                {activeCount === 0 ? (
                  <>Sin miembros aún</>
                ) : (
                  <>
                    <span className="text-slate-900">{activeCount}</span>{" "}
                    <span className="text-slate-800">{activeCount === 1 ? "miembro activo" : "miembros activos"}</span>
                  </>
                )}
              </h1>
              <p className="text-sm text-slate-500 mt-2">
                {inactiveCount > 0
                  ? `${inactiveCount} inactivo${inactiveCount === 1 ? "" : "s"} · gestioná roles, posiciones y status.`
                  : "Gestioná roles, posiciones e invitaciones."}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={fetchTeam}
                disabled={loading}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-100 transition-all disabled:opacity-40"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowInvite(true)}
                  className="group flex items-center gap-2 h-10 rounded-xl bg-[#E42D2C] px-4 text-[13px] font-bold text-slate-900 shadow-[0_8px_24px_rgba(228,45,44,0.25)] hover:bg-[#c42423] hover:shadow-[0_12px_32px_rgba(228,45,44,0.40)] transition-all"
                >
                  <UserPlus className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" />
                  Invitar
                </button>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="relative grid grid-cols-2 sm:grid-cols-4 border-t border-slate-100">
            {[
              { label: "Total",           val: members.length, icon: Users2 },
              { label: "Admins",          val: adminCount,     icon: Crown },
              { label: "Personas a cargo",val: totalPersonas,  icon: Users2 },
              { label: "Tareas asignadas",val: totalTasks,     icon: ListTodo },
            ].map((s, i) => {
              const StatIcon = s.icon
              return (
                <div
                  key={s.label}
                  className={`relative px-5 py-4 ${i < 3 ? "sm:border-r border-slate-100" : ""} ${i < 2 ? "border-b sm:border-b-0 border-slate-100" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <StatIcon className="h-3 w-3 text-slate-400" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1e3a8a]/80">
                      {s.label}
                    </span>
                  </div>
                  <p className="text-[24px] font-bold tabular-nums text-slate-900 leading-none">
                    {s.val}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, posición..."
            className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-300 focus:border-[#1e3a8a]/40 focus:outline-none flex-1 min-w-[220px] max-w-sm"
          />
          <div className="flex items-center gap-1.5">
            {(["todos", "activo", "inactivo"] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`h-9 rounded-xl border px-3.5 text-[12px] font-medium transition-all capitalize ${
                  filterStatus === s
                    ? "border-[#E42D2C]/40 bg-[#E42D2C]/10 text-[#ff6b6a]"
                    : "border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300"
                }`}>
                {s}
              </button>
            ))}
          </div>
          {departments.length > 0 && (
            <select
              value={filterDepartment}
              onChange={e => setFilterDepartment(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none cursor-pointer hover:border-slate-300"
            >
              <option value="todos">Todos los departamentos</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#E42D2C]/40" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white py-20 text-center">
            <div className="pointer-events-none absolute -top-24 -right-24 h-[300px] w-[300px] rounded-full bg-[#E42D2C]/[0.06] blur-[100px]" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E42D2C]/10 ring-1 ring-[#E42D2C]/25 mb-4">
              <Shield className="h-6 w-6 text-[#ff6b6a]" />
            </span>
            <h3 className="relative text-[16px] font-bold text-slate-900 mb-1">
              {members.length === 0 ? "Sumá al primer miembro del equipo" : "Sin coincidencias"}
            </h3>
            <p className="relative max-w-sm text-[13px] text-slate-500 mb-5 px-4">
              {members.length === 0
                ? "Mandá invitaciones por email. Cuando acepten, aparecen acá automáticamente con su rol y posición."
                : "Probá con otra búsqueda o cambiá el filtro de status."}
            </p>
            {isAdmin && members.length === 0 && (
              <button
                onClick={() => setShowInvite(true)}
                className="group relative flex items-center gap-2 h-10 rounded-xl bg-[#E42D2C] px-4 text-[13px] font-bold text-slate-900 shadow-[0_8px_24px_rgba(228,45,44,0.25)] hover:bg-[#c42423] hover:shadow-[0_12px_32px_rgba(228,45,44,0.40)] transition-all"
              >
                <UserPlus className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" />
                Invitar al primer miembro
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(m => (
              <MemberCard key={m.id} member={m} department={m.department_id ? deptMap.get(m.department_id) ?? null : null} onClick={() => setSelected(m)} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
