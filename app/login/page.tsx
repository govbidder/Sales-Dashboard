"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
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
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12 relative overflow-hidden">

      {/* Subtle ambient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-[#E42D2C]/[0.05] blur-[160px]" />
        <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-[#1e3a8a]/[0.04] blur-[140px]" />
      </div>

      <div className="relative w-full max-w-[400px]">

        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/icon.png"
            alt="GovBidder · The Bid That Wins"
            width={260}
            height={200}
            className="h-auto w-[220px] object-contain"
            priority
          />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">

          <div className="mb-7 text-center">
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Iniciar sesión</h1>
            <p className="mt-1.5 text-[13px] text-slate-500">
              Ingresá con tus credenciales para acceder.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Email
              </label>
              <input
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-all focus:border-[#E42D2C] focus:ring-2 focus:ring-[#E42D2C]/15"
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
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Contraseña
                </label>
                <a
                  href="/forgot-password"
                  className="text-[11px] text-slate-500 transition-colors hover:text-[#E42D2C]"
                >
                  ¿La olvidaste?
                </a>
              </div>
              <input
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-all focus:border-[#E42D2C] focus:ring-2 focus:ring-[#E42D2C]/15"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-relaxed text-red-700">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full rounded-full bg-[#E42D2C] text-sm font-bold text-white transition-all hover:bg-[#c42423] hover:shadow-[0_8px_24px_rgba(228,45,44,0.30)] disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Entrando…
                </span>
              ) : (
                "Ingresar"
              )}
            </button>
          </form>

          <p className="mt-7 text-center text-[11px] leading-relaxed text-slate-400">
            Si tu cuenta requiere verificación, revisá tu inbox antes de entrar.
          </p>
        </div>

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.22em] text-slate-300">
          © {new Date().getFullYear()} GovBidder · The Bid That Wins
        </p>
      </div>
    </div>
  );
}
