"use client";

import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, Lock, ShieldCheck, User as UserIcon } from "lucide-react";
import { YzLogo } from "@/components/yz/Logo";
import { YzLoader } from "@/components/yz/Loader";
import { apiFetch, getToken } from "@/lib/api";

type Me = {
  username?: string;
  phone?: string;
  first_name?: string;
  has_password?: boolean;
};

/**
 * Mandatory step right after Telegram sign-in: choose a login (username or
 * phone) and a password so the account also works standalone — in the native
 * app and a plain browser, without Telegram. The dashboard gate
 * (AuthBootstrap) sends every password-less account here and refuses to let
 * it through until this is done; there is deliberately no skip.
 */
export default function SetupPage() {
  const [stage, setStage] = useState<"checking" | "form">("checking");
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      window.location.replace("/auth/login");
      return;
    }
    apiFetch<Me>("/api/auth/me")
      .then((m) => {
        // Already has a password — nothing to do here, go to the dashboard.
        if (m.has_password) {
          window.location.replace("/dashboard");
          return;
        }
        setName(m.first_name || "");
        // Pre-fill with the Telegram username (if any) so the common case is
        // one tap; the user can replace it with a phone number instead.
        setLoginId(m.username || m.phone || "");
        setStage("form");
      })
      .catch(() => window.location.replace("/auth/login"));
  }, []);

  const passwordsMatch = confirm.length === 0 || confirm === password;
  const canSubmit =
    password.length >= 6 &&
    password === confirm &&
    loginId.trim().length >= 3 &&
    !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/api/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ password, login: loginId.trim() }),
      });
      window.location.replace("/dashboard");
    } catch (e) {
      setErr((e as Error).message || "Xatolik");
      setBusy(false);
    }
  }

  if (stage === "checking") return <YzLoader fullscreen />;

  return (
    <main
      className="min-h-screen bg-ink-50"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="px-4 pb-20 pt-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-2.5">
            <YzLogo size={36} variant="dark" />
            <div className="font-display text-[17px] font-extrabold tracking-tight text-ink-900">
              Yozuv
            </div>
          </div>

          <div className="mt-9 animate-card-in">
            <div className="eyebrow">
              {name ? `Salom, ${name}!` : "Telegram tasdiqlandi"}
            </div>
            <h1 className="mt-2 display-xl text-[30px] leading-[1.07]">
              Login va parol o‘rnating
            </h1>
            <p className="mt-2.5 max-w-xs text-sm text-ink-500">
              Ilovaga Telegramsiz ham kirish uchun login va parol yarating. Bu
              bir martalik qadam.
            </p>
          </div>

          <div className="tile-indigo mt-6 flex items-start gap-3.5 animate-card-in">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/70 text-indigo-600">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div className="text-[13px] leading-relaxed text-ink-600">
              Login sifatida <b className="text-ink-900">username</b> yoki{" "}
              <b className="text-ink-900">telefon raqami</b> ishlatishingiz mumkin.
            </div>
          </div>

          <form onSubmit={submit} className="card-lg mt-4 p-6 animate-card-in">
            <label className="block">
              <span className="eyebrow mb-2 block px-1">Login</span>
              <div className="relative">
                <UserIcon
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                  strokeWidth={2.2}
                />
                <input
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  autoComplete="username"
                  inputMode="text"
                  placeholder="username yoki +998 90 123 45 67"
                  className="yz-input pl-11 tnum"
                />
              </div>
            </label>

            <label className="mt-3 block">
              <span className="eyebrow mb-2 block px-1">Yangi parol</span>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                  strokeWidth={2.2}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Kamida 6 ta belgi"
                  className="yz-input pl-11"
                />
              </div>
            </label>

            <label className="mt-3 block">
              <span className="eyebrow mb-2 block px-1">Parolni tasdiqlang</span>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                  strokeWidth={2.2}
                />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Parolni qayta kiriting"
                  className="yz-input pl-11"
                />
              </div>
              {!passwordsMatch && (
                <div className="mt-1.5 px-1 text-[11px] font-semibold text-danger">
                  Parollar mos emas
                </div>
              )}
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-primary mt-5 w-full justify-center disabled:opacity-50"
            >
              {busy ? "Saqlanmoqda…" : "Davom etish"}
              {!busy && <ArrowRight className="ml-2 h-4 w-4" />}
            </button>

            {err && (
              <div className="mt-3 whitespace-pre-wrap text-center text-xs font-semibold text-danger">
                {err}
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
