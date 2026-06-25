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
        <div className="tile-indigo mb-4 flex items-start gap-3.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/70 text-indigo-600">
            <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="text-[13px] leading-relaxed text-ink-600">
            Parol o‘rnatsangiz, ilovaga{" "}
            <b className="text-ink-900">{me?.username || me?.phone || "loginingiz"}</b> va parol
            bilan Telegramsiz kira olasiz.
          </div>
        </div>

        <form onSubmit={submit} className="card-lg space-y-4 p-5">
          <div>
            <div className="eyebrow mb-2 px-1">
              Login
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-ink-200 bg-white px-4 py-3.5 transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15">
              <UserIcon className="h-4.5 w-4.5 text-ink-400" strokeWidth={2.2} />
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
              <div className="mt-1.5 px-1 text-[11px] font-medium text-ink-400">
                Login profilingizdan olinadi
              </div>
            )}
          </div>

          <div>
            <div className="eyebrow mb-2 px-1">
              Yangi parol
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-ink-200 bg-white px-4 py-3.5 transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15">
              <Lock className="h-4.5 w-4.5 text-ink-400" strokeWidth={2.2} />
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
            <div className="eyebrow mb-2 px-1">
              Parolni tasdiqlang
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-ink-200 bg-white px-4 py-3.5 transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15">
              <KeyRound className="h-4.5 w-4.5 text-ink-400" strokeWidth={2.2} />
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
              <div className="mt-1.5 px-1 text-[11px] font-semibold text-danger">Parollar mos emas</div>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary tap mt-1 w-full justify-center"
          >
            {busy ? "Saqlanmoqda…" : "Parolni saqlash"}
          </button>
        </form>
      </div>
    </div>
  );
}
