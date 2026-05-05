"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mail, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
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
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12 relative overflow-hidden">

      {/* Subtle ambient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-[#E42D2C]/[0.05] blur-[160px]" />
        <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-[#1e3a8a]/[0.04] blur-[140px]" />
      </div>

      <div className="relative w-full max-w-[420px]">

        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/icon.png"
            alt="GovBidder · The Bid That Wins"
            width={260}
            height={200}
            className="h-auto w-[200px] object-contain"
            priority
          />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">

          <div className="mb-7 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E42D2C]/10 to-[#1e3a8a]/10 ring-1 ring-[#1e3a8a]/15">
              <Mail className="h-5 w-5 text-[#1e3a8a]" />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
              Recuperar contraseña
            </h1>
            <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">
              Te enviamos un link a tu email para que puedas resetearla.
            </p>
          </div>

          {msg ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-[12px] leading-relaxed text-emerald-800">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                <span>{msg}</span>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 transition-colors hover:text-[#E42D2C]"
              >
                <ArrowLeft className="h-3 w-3" />
                Volver al login
              </Link>
            </div>
          ) : (
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

              {err && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-relaxed text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                  <span>{err}</span>
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
                    Enviando…
                  </span>
                ) : (
                  "Enviar link de recuperación"
                )}
              </button>

              <div className="pt-1 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-[#E42D2C]"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Volver al login
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.22em] text-slate-300">
          © {new Date().getFullYear()} GovBidder · The Bid That Wins
        </p>
      </div>
    </div>
  );
}
