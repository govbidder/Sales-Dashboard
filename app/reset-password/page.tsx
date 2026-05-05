"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase";

function parseHashParams(hash: string) {
  const out: Record<string, string> = {};
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(h);
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function friendlyAuthError(hashParams: Record<string, string>) {
  const code = hashParams["error_code"];
  const desc = hashParams["error_description"]
    ? decodeURIComponent(hashParams["error_description"])
    : "";

  if (code === "otp_expired") {
    return "El link expiró o ya fue usado. Pedí uno nuevo desde Forgot password.";
  }
  if (code === "access_denied") {
    return "Acceso denegado. Pedí un nuevo link desde Forgot password y abrilo apenas llegue.";
  }
  return desc || "Link inválido o rechazado.";
}

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [linkValidated, setLinkValidated] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);

  // Avoid contradictory UI (info + error) during link validation.
  const validatedByLinkRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    async function init() {
      setErr(null);
      setInfo(null);
      setReady(false);
      setLinkValidated(false);
      validatedByLinkRef.current = false;

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");

      const hashParams = window.location.hash ? parseHashParams(window.location.hash) : {};
      const hashHasAccessToken = Boolean(hashParams["access_token"]);

      // Explicit error returned by Supabase in the hash.
      if (hashParams["error"] || hashParams["error_code"]) {
        const message = friendlyAuthError(hashParams);
        if (!mounted) return;
        setErr(message);
        setHasSession(false);
        setReady(true);
        return;
      }

      try {
        // 0) Recovery link flow: ?token_hash=...&type=recovery
        if (tokenHash && type === "recovery") {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (error) throw error;

          if (data?.session?.access_token && data?.session?.refresh_token) {
            await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            });
          }

          validatedByLinkRef.current = true;
          if (!mounted) return;
          setLinkValidated(true);
          setHasSession(Boolean(data?.session));

          url.searchParams.delete("token_hash");
          url.searchParams.delete("type");
          window.history.replaceState({}, document.title, url.toString());

          if (!mounted) return;
          setInfo("Link validado. Ahora podés elegir tu nueva contraseña.");
        }

        // 1) PKCE flow: exchange ?code= for a session.
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          if (data?.session?.access_token && data?.session?.refresh_token) {
            await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            });
          }

          validatedByLinkRef.current = true;
          if (!mounted) return;
          setLinkValidated(true);
          setHasSession(Boolean(data?.session));

          url.searchParams.delete("code");
          url.searchParams.delete("type");
          window.history.replaceState({}, document.title, url.toString());

          if (!mounted) return;
          setInfo("Link validado. Ahora podés elegir tu nueva contraseña.");
        }

        // 2) Hash flow: access_token in hash.
        if (!code && hashHasAccessToken) {
          const access_token = hashParams["access_token"];
          const refresh_token = hashParams["refresh_token"];
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
          }

          validatedByLinkRef.current = true;
          if (!mounted) return;
          setLinkValidated(true);

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.search
          );

          const { data } = await supabase.auth.getSession();
          setHasSession(Boolean(data.session));

          if (!mounted) return;
          setInfo("Link validado. Ahora podés elegir tu nueva contraseña.");
        }

        // 3) Subscribe to auth changes to avoid race conditions.
        const sub = supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          const ok = Boolean(session);
          setHasSession(ok);
          if (ok) setErr(null);
        });
        unsubscribe = () => sub.data.subscription.unsubscribe();

        // 4) Small delay + retry session read.
        await new Promise((r) => setTimeout(r, 250));

        let ok = false;
        for (let i = 0; i < 10; i++) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          ok = Boolean(data.session);
          if (ok) break;
          await new Promise((r) => setTimeout(r, 250));
        }

        if (!mounted) return;
        setHasSession(ok);

        if (!ok && validatedByLinkRef.current) {
          setErr(
            "Validé el link pero no pude obtener una sesión. Esto suele pasar si abriste el link en una pestaña distinta, " +
              "mezclaste localhost con 127.0.0.1, o el redirect URL no coincide exactamente con el configurado en Supabase. " +
              "Pedí un nuevo link y abrilo directo desde el email en esta misma pestaña (mismo host)."
          );
        }

        if (!ok && !validatedByLinkRef.current) {
          setErr(
            "El link de recuperación no contiene una sesión válida (no encontré ?code= o #access_token). " +
              "Pedí un nuevo link desde Forgot password y abrilo apenas llegue."
          );
        }
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || "No pude validar el link de recuperación.");
        setHasSession(false);
      } finally {
        if (!mounted) return;
        setReady(true);
      }
    }

    init();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);

    if (!hasSession && linkValidated) {
      const { data } = await supabase.auth.getSession();
      if (data.session) setHasSession(true);
    }

    if (!hasSession) {
      setErr(
        "No hay sesión válida para cambiar la contraseña. Pedí un nuevo link desde Forgot password y abrilo apenas llegue."
      );
      return;
    }

    if (password.length < 6) {
      setErr("La contraseña debe tener mínimo 6 caracteres.");
      return;
    }

    if (password !== password2) {
      setErr("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setInfo("Contraseña actualizada. Redirigiendo al login...");
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const inputsEnabled = ready && (hasSession || linkValidated);

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
              <Lock className="h-5 w-5 text-[#1e3a8a]" />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
              Restablecer contraseña
            </h1>
            <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">
              {ready && !hasSession && !linkValidated
                ? "Validando el link de recuperación…"
                : "Elegí una nueva contraseña para tu cuenta."}
            </p>
          </div>

          {/* Loading state */}
          {!ready && (
            <div className="flex items-center justify-center py-6">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#E42D2C]" />
            </div>
          )}

          {ready && (
            <form onSubmit={onSubmit} className="space-y-4">

              {/* Info banner */}
              {info && (
                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] leading-relaxed text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                  <span>{info}</span>
                </div>
              )}

              {/* Error banner */}
              {err && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-relaxed text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                  <span className="whitespace-pre-wrap">{err}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Nueva contraseña
                </label>
                <input
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-all focus:border-[#E42D2C] focus:ring-2 focus:ring-[#E42D2C]/15 disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder="Mínimo 6 caracteres"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={!inputsEnabled}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Repetir contraseña
                </label>
                <input
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-all focus:border-[#E42D2C] focus:ring-2 focus:ring-[#E42D2C]/15 disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder="Repetí la contraseña"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  disabled={!inputsEnabled}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !hasSession}
                className="mt-2 h-12 w-full rounded-full bg-[#E42D2C] text-sm font-bold text-white transition-all hover:bg-[#c42423] hover:shadow-[0_8px_24px_rgba(228,45,44,0.30)] disabled:opacity-50 active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Actualizando…
                  </span>
                ) : (
                  "Actualizar contraseña"
                )}
              </button>
            </form>
          )}

          {/* Footer links */}
          <div className="mt-7 flex items-center justify-between border-t border-slate-100 pt-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-[#E42D2C]"
            >
              <ArrowLeft className="h-3 w-3" />
              Volver al login
            </Link>
            <Link
              href="/forgot-password"
              className="text-[11px] font-medium text-slate-500 transition-colors hover:text-[#E42D2C]"
            >
              Pedir nuevo link
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.22em] text-slate-300">
          © {new Date().getFullYear()} GovBidder · The Bid That Wins
        </p>
      </div>
    </div>
  );
}
