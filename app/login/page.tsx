"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/inicio");
    });
  }, [router, supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErrorMsg(error.message); return; }
    const { data } = await supabase.auth.getSession();
    if (data.session) router.replace("/inicio");
    else setErrorMsg("No se pudo obtener la sesión. Intenta nuevamente.");
  }

  return (
    <div className="min-h-screen bg-[#080d1e] flex items-center justify-center px-6 py-12 relative overflow-hidden">

      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-[#E42D2C]/[0.08] blur-[160px]" />
        <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-[#152978]/30 blur-[140px]" />
      </div>

      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <div className="relative w-full max-w-[400px]">

        {/* Logo */}
        <div className="mb-10 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff6b6a] to-[#c42423] shadow-[0_0_24px_rgba(228,45,44,0.45)]">
            <span className="text-[13px] font-black text-white tracking-tight">GB</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[16px] font-bold tracking-tight text-white">GovBidder</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40 mt-1">Portal Interno</span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0d1745]/60 backdrop-blur-xl p-8 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">

          <div className="mb-7">
            <h1 className="text-[22px] font-bold tracking-tight text-white">Iniciar sesión</h1>
            <p className="mt-1.5 text-[13px] text-white/40">
              Ingresá con tus credenciales para acceder.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/35">
                Email
              </label>
              <input
                className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm text-white outline-none placeholder:text-white/25 transition-all focus:border-[#E42D2C]/50 focus:bg-white/[0.05] focus:ring-2 focus:ring-[#E42D2C]/10"
                placeholder="tu@email.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/35">
                  Contraseña
                </label>
                <a
                  href="/forgot-password"
                  className="text-[11px] text-white/35 transition-colors hover:text-[#E42D2C]"
                >
                  ¿La olvidaste?
                </a>
              </div>
              <input
                className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm text-white outline-none placeholder:text-white/25 transition-all focus:border-[#E42D2C]/50 focus:bg-white/[0.05] focus:ring-2 focus:ring-[#E42D2C]/10"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[12px] leading-relaxed text-red-300">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full rounded-xl bg-[#E42D2C] text-sm font-bold text-white transition-all hover:bg-[#c42423] hover:shadow-[0_8px_24px_rgba(228,45,44,0.30)] disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Entrando…
                </span>
              ) : (
                "Ingresar"
              )}
            </button>
          </form>

          <p className="mt-7 text-center text-[11px] leading-relaxed text-white/25">
            Si tu cuenta requiere verificación, revisá tu inbox antes de entrar.
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.22em] text-white/15">
          © {new Date().getFullYear()} GovBidder · Interno
        </p>
      </div>
    </div>
  );
}
