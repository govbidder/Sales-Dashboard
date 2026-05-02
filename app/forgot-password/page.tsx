"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      setErr("No pudimos enviar el email. Verificá que la dirección sea correcta.");
      return;
    }

    setMsg("Listo. Revisá tu inbox y hacé click en el link para resetear tu contraseña.");
  }

  return (
    <div className="min-h-screen bg-[#080d1e] flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden border-r border-white/[0.05]">

        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-0 h-[500px] w-[500px] rounded-full bg-[#E42D2C]/[0.06] blur-[140px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[#E42D2C]/[0.03] blur-[120px]" />
        </div>

        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        {/* Top: Logo */}
        <div className="relative flex items-center gap-3">
          <span className="text-white text-sm font-bold tracking-[0.22em]">SMART</span>
          <span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold tracking-wide text-black">
            SCALE
          </span>
        </div>

        {/* Center: Hero text */}
        <div className="relative space-y-6">
          <div className="flex items-center gap-2.5">
            <span className="h-[3px] w-8 rounded-full bg-[#E42D2C]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#E42D2C]/70">Recuperar acceso</span>
          </div>

          <h2 className="text-4xl font-bold leading-[1.15] tracking-tight text-white">
            ¿Olvidaste<br />
            tu contraseña?<br />
            <span className="text-[#E42D2C]">Te ayudamos.</span>
          </h2>

          <p className="max-w-sm text-sm leading-relaxed text-white/35">
            Ingresá tu email y te enviamos un link para que puedas elegir una nueva contraseña en segundos.
          </p>
        </div>

        {/* Bottom: Version */}
        <div className="relative">
          <p className="text-[10px] uppercase tracking-widest text-white/15">
            © {new Date().getFullYear()} GovBidder
          </p>
        </div>
      </div>

      {/* ── Right panel: Form ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 relative">

        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <span className="text-white text-sm font-bold tracking-[0.22em]">SMART</span>
          <span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold tracking-wide text-black">
            SCALE
          </span>
        </div>

        <div className="w-full max-w-[360px]">

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">Recuperar contraseña</h1>
            <p className="mt-1.5 text-sm text-white/35">
              Te enviamos un link a tu email para que puedas resetearla.
            </p>
          </div>

          {msg ? (
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-4 text-sm leading-relaxed text-green-300">
              {msg}
              <div className="mt-4">
                <Link href="/login" className="text-xs text-white/40 hover:text-[#E42D2C] transition">
                  ← Volver al login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/30">
                  Email
                </label>
                <input
                  className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/20 transition-all focus:border-[#E42D2C]/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-[#E42D2C]/10"
                  placeholder="tu@email.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              {err && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-300">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 h-12 w-full rounded-xl bg-[#E42D2C] text-sm font-bold text-white transition-all hover:bg-[#c42423] hover:shadow-lg hover:shadow-[#E42D2C]/20 disabled:opacity-50 active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                    Enviando…
                  </span>
                ) : (
                  "Enviar link de recuperación"
                )}
              </button>

              <div className="pt-1 text-center">
                <Link href="/login" className="text-[11px] text-white/30 hover:text-[#E42D2C] transition">
                  ← Volver al login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
