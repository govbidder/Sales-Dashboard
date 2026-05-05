"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Sparkles, X, Send, Loader2, Bot, User as UserIcon, RotateCw } from "lucide-react"
import { Portal } from "@/components/ui/portal"
import { useToast } from "@/components/ui/toast"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id:      string
  role:    "user" | "assistant"
  content: string
  time:    number
}

const STORAGE_KEY = "ai-chat-history"
const MAX_PERSISTED = 30  // keep last 30 messages in localStorage
const PAGE_TITLES: Record<string, string> = {
  "/inicio":                 "Página Principal",
  "/dashboard":              "Panel",
  "/sales":                  "Ingresos",
  "/metrics":                "Métricas",
  "/admin/reports":          "Cargar Métricas",
  "/admin/personas":         "Personas Agendadas",
  "/admin/tasks":            "Tareas",
  "/admin/team":             "Equipo",
  "/admin/centro-operativo": "Centro Operativo",
  "/tools":                  "Herramientas",
  "/recursos":               "Recursos",
  "/calendar":               "Agenda",
}

const SUGGESTED: { label: string; prompt: string }[] = [
  { label: "Resumí el estado del dashboard", prompt: "Resumí en 3 bullets el estado actual del dashboard." },
  { label: "Sugerencias para hoy",            prompt: "Basado en el estado actual, ¿qué deberíamos priorizar hoy?" },
  { label: "Redactá un follow-up",            prompt: "Redactá un mensaje de WhatsApp corto y cordial para hacer seguimiento a una persona agendada que no respondió hace 5 días." },
  { label: "¿Qué significa MRR?",             prompt: "Explicame qué es MRR y por qué importa." },
]

// ─── Floating Button + Panel ──────────────────────────────────────────────────

export function AIAssistant({ selectedMonth }: { selectedMonth?: string | null }) {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState("")
  const [sending, setSending]   = useState(false)
  const pathname = usePathname()
  const toast = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Load history
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try { setMessages(JSON.parse(stored)) } catch {}
    }
  }, [])

  // Persist
  useEffect(() => {
    if (typeof window === "undefined") return
    const trimmed = messages.slice(-MAX_PERSISTED)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  }, [messages])

  // Autoscroll on new message
  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    })
  }, [messages, open])

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim()
    if (!text || sending) return

    const userMsg: ChatMessage = {
      id:      crypto.randomUUID(),
      role:    "user",
      content: text,
      time:    Date.now(),
    }
    const nextHistory = [...messages, userMsg]
    setMessages(nextHistory)
    setInput("")
    setSending(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error("Necesitás estar logueado"); return }

      const res = await fetch("/api/ai/chat", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: nextHistory.map(m => ({ role: m.role, content: m.content })),
          pagePath:  pathname,
          pageTitle: PAGE_TITLES[pathname] ?? null,
          selectedMonth,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error ?? "Error del modelo")
        return
      }

      const replyMsg: ChatMessage = {
        id:      crypto.randomUUID(),
        role:    "assistant",
        content: json.reply ?? "(respuesta vacía)",
        time:    Date.now(),
      }
      setMessages(prev => [...prev, replyMsg])
    } catch (e: any) {
      toast.error(e?.message ?? "Error de red")
    } finally {
      setSending(false)
    }
  }

  const reset = () => {
    setMessages([])
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <Portal>
      {/* Floating button — visible when panel closed */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="group fixed bottom-5 right-5 z-[90] flex items-center gap-2 h-12 rounded-full bg-gradient-to-br from-[#E42D2C] via-[#c42423] to-[#1e3a8a] pl-3.5 pr-4 text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(30,58,138,0.35)] hover:shadow-[0_12px_32px_rgba(30,58,138,0.50)] hover:scale-[1.02] transition-all"
          aria-label="Abrir asistente"
        >
          <span className="relative flex h-6 w-6 items-center justify-center">
            <Sparkles className="h-4 w-4" />
            <span className="absolute inset-0 rounded-full bg-white/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
          <span>Asistente</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <>
          {/* Subtle backdrop on mobile */}
          <div
            className="fixed inset-0 z-[120] bg-slate-900/20 sm:hidden"
            onClick={() => setOpen(false)}
          />

          <div
            className="fixed bottom-5 right-5 z-[121] flex flex-col w-[380px] max-w-[calc(100vw-2.5rem)] h-[600px] max-h-[calc(100vh-3rem)] overflow-hidden rounded-2xl border border-slate-200 shadow-[0_30px_80px_rgba(15,23,42,0.20)] page-enter"
            style={{ backgroundColor: "#ffffff" }}
          >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute -top-32 -right-32 h-[300px] w-[300px] rounded-full bg-[#E42D2C]/[0.10] blur-[80px]" />

            {/* Header */}
            <div className="relative shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff6b6a] to-[#c42423] shadow-[0_0_16px_rgba(228,45,44,0.35)]">
                  <Sparkles className="h-4 w-4 text-white" />
                </span>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-900 leading-none">Asistente GovBidder</h3>
                  <p className="text-[11px] text-slate-500 mt-1">Powered by Claude</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={reset}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
                    title="Reiniciar conversación"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center text-center pt-6 pb-2">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E42D2C]/[0.10] ring-1 ring-[#E42D2C]/25 mb-3">
                    <Bot className="h-5 w-5 text-[#ff6b6a]" />
                  </span>
                  <h4 className="text-[14px] font-bold text-slate-900 mb-1">¿En qué te ayudo?</h4>
                  <p className="text-[12px] text-slate-500 leading-relaxed max-w-[280px]">
                    Pregúntame sobre métricas, redactá un follow-up, o pedí sugerencias del día.
                  </p>

                  <div className="mt-5 w-full space-y-1.5">
                    {SUGGESTED.map(s => (
                      <button
                        key={s.label}
                        onClick={() => send(s.prompt)}
                        className="group flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100 px-3 py-2.5 text-left transition-all"
                      >
                        <Sparkles className="h-3 w-3 shrink-0 text-[#ff6b6a]/60" />
                        <span className="text-[12px] text-slate-700 group-hover:text-slate-900">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map(m => <Message key={m.id} message={m} />)
              )}
              {sending && (
                <div className="flex items-start gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E42D2C]/15 ring-1 ring-[#E42D2C]/30">
                    <Bot className="h-3.5 w-3.5 text-[#ff6b6a]" />
                  </span>
                  <div className="flex items-center gap-1.5 px-3 py-2.5">
                    <Dot delay={0} />
                    <Dot delay={150} />
                    <Dot delay={300} />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="relative shrink-0 border-t border-slate-200 bg-slate-50 p-3">
              <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-white/20 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Escribí tu pregunta…"
                  rows={1}
                  className="flex-1 bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 outline-none resize-none max-h-[120px] py-1"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || sending}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E42D2C] text-white shadow-[0_4px_12px_rgba(228,45,44,0.30)] hover:bg-[#c42423] disabled:opacity-30 disabled:shadow-none transition-all"
                  aria-label="Enviar"
                >
                  {sending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-slate-300 text-center">
                Enter para enviar · Shift+Enter para nueva línea
              </p>
            </div>
          </div>
        </>
      )}
    </Portal>
  )
}

// ─── Message ──────────────────────────────────────────────────────────────────

function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
        isUser
          ? "bg-slate-100 ring-1 ring-slate-200"
          : "bg-[#E42D2C]/15 ring-1 ring-[#E42D2C]/30"
      }`}>
        {isUser
          ? <UserIcon className="h-3.5 w-3.5 text-slate-600" />
          : <Bot      className="h-3.5 w-3.5 text-[#ff6b6a]" />}
      </span>
      <div className={`max-w-[78%] rounded-xl px-3 py-2.5 text-[13px] leading-relaxed ${
        isUser
          ? "bg-[#E42D2C]/10 text-slate-900 border border-[#E42D2C]/20"
          : "bg-slate-50 text-slate-900 border border-slate-200"
      }`}>
        <RenderText text={message.content} />
      </div>
    </div>
  )
}

// Lightweight markdown-ish rendering: bold, line breaks, simple lists
function RenderText({ text }: { text: string }) {
  // Split into paragraphs by double newline
  const paragraphs = text.split(/\n{2,}/)
  return (
    <>
      {paragraphs.map((p, i) => {
        // Detect bullet list (lines starting with "-" or "•")
        const lines = p.split("\n")
        const isList = lines.length > 1 && lines.every(l => /^\s*(?:[-•*]|\d+\.)\s/.test(l) || l.trim() === "")
        if (isList) {
          return (
            <ul key={i} className="list-disc pl-4 my-1 space-y-0.5">
              {lines.filter(l => l.trim()).map((l, j) => (
                <li key={j}>{formatInline(l.replace(/^\s*(?:[-•*]|\d+\.)\s/, ""))}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className={i > 0 ? "mt-2" : ""}>
            {p.split("\n").map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {formatInline(line)}
              </span>
            ))}
          </p>
        )
      })}
    </>
  )
}

function formatInline(text: string): React.ReactNode {
  // Bold **xxx**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
    }
    return p
  })
}

// Typing indicator dot
function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="block h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    />
  )
}
