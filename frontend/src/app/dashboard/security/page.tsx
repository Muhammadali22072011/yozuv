"use client";

import { useEffect, useState } from "react";
import { KeyRound, Lock, ShieldCheck, User as UserIcon } from "lucide-react";
import { ScreenHeader, useToast } from "@/components/yz";
import { apiFetch } from "@/lib/api";

type Me = {
  username?: string;
  phone?: string;
};

export default function SecurityPage() {
  const toast = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<Me>("/api/auth/me")
      .then((m) => {
        setMe(m);
        setLoginId(m.username || m.phone || "");
      })
      .catch(() => null);
  }, []);

  const hasLogin = Boolean(me?.username || me?.phone);
  const canSubmit =
    password.length >= 6 &&
    password === confirm &&
    (hasLogin || loginId.trim().length >= 3) &&
    !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await apiFetch("/api/auth/set-password", {
        method: "POST",
        body: JSON.stringify({
          password,
          login: hasLogin ? undefined : loginId.trim(),
        }),
      });
      toast("Parol o‘rnatildi");
      setPassword("");
      setConfirm("");
    } catch (err) {
      toast((err as Error).message || "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md pb-24">
      <ScreenHeader
        title="Login va parol"
        subtitle="Ilovaga Telegramsiz kirish"
        back="/dashboard/settings"
      />

      <div className="px-4 md:px-0">
        <div className="card-soft mb-4 flex items-start gap-3 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600/10 text-indigo-600">
            <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="text-[13px] leading-relaxed text-ink-600">
            Parol o‘rnatsangiz, ilovaga{" "}
            <b className="text-ink-900">{me?.username || me?.phone || "loginingiz"}</b> va parol
            bilan Telegramsiz kira olasiz.
          </div>
        </div>

        <form onSubmit={submit} className="card-soft space-y-3 p-5">
          <div>
            <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-400">
              Login
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-ink-200 bg-white px-3.5 py-3 focus-within:border-indigo-500">
              <UserIcon className="h-4 w-4 text-ink-400" strokeWidth={2.2} />
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                disabled={hasLogin}
                autoComplete="username"
                placeholder="Telefon yoki username"
                className="w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400 disabled:text-ink-500"
              />
            </div>
            {hasLogin && (
              <div className="mt-1 px-1 text-[11px] text-ink-400">
                Login profilingizdan olinadi
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-400">
              Yangi parol
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-ink-200 bg-white px-3.5 py-3 focus-within:border-indigo-500">
              <Lock className="h-4 w-4 text-ink-400" strokeWidth={2.2} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Kamida 6 ta belgi"
                className="w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-400">
              Parolni tasdiqlang
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-ink-200 bg-white px-3.5 py-3 focus-within:border-indigo-500">
              <KeyRound className="h-4 w-4 text-ink-400" strokeWidth={2.2} />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Parolni qayta kiriting"
                className="w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
              />
            </div>
            {confirm.length > 0 && confirm !== password && (
              <div className="mt-1 px-1 text-[11px] text-[#C93A2A]">Parollar mos emas</div>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary w-full justify-center disabled:opacity-50"
          >
            {busy ? "Saqlanmoqda…" : "Parolni saqlash"}
          </button>
        </form>
      </div>
    </div>
  );
}
