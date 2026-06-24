"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, Lock, Send, Shield, Sparkles, User as UserIcon } from "lucide-react";
import { HeroGradient } from "@/components/yz/HeroGradient";
import { YzLogo } from "@/components/yz/Logo";
import { apiBase } from "@/lib/api";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: unknown;
        ready?: () => void;
        expand?: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        version?: string;
        platform?: string;
      };
    };
  }
}

function log(bag: string[], line: string) {
  bag.push(line);
}

export default function LoginPage() {
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [debug, setDebug] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  async function loginWithPassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwBusy) return;
    setPwBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${apiBase()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: loginId.trim(), password }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try {
          msg = (JSON.parse(text) as { detail?: string }).detail ?? text;
        } catch {
          // keep raw text
        }
        setErr(msg || `HTTP ${res.status}`);
        return;
      }
      const tokens = JSON.parse(text) as { access_token: string; refresh_token: string };
      localStorage.setItem("yozuv_access", tokens.access_token);
      localStorage.setItem("yozuv_refresh", tokens.refresh_token);
      window.location.href = "/dashboard";
    } catch (e) {
      setErr((e as Error).message || "Xatolik");
    } finally {
      setPwBusy(false);
    }
  }

  async function loginWithTelegram() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const bag: string[] = [];
    try {
      try {
        window.Telegram?.WebApp?.ready?.();
        window.Telegram?.WebApp?.expand?.();
      } catch (e) {
        log(bag, `ready/expand err: ${(e as Error).message}`);
      }

      const wa = window.Telegram?.WebApp;
      log(bag, `has Telegram.WebApp: ${!!wa}`);
      log(bag, `WebApp.version: ${wa?.version ?? "n/a"}`);
      log(bag, `WebApp.platform: ${wa?.platform ?? "n/a"}`);
      log(bag, `initData.length: ${wa?.initData?.length ?? 0}`);
      log(bag, `origin: ${window.location.origin}`);

      const initData = wa?.initData;
      if (!initData) {
        setErr("initData bo‘sh. Mini App orqali oching (menu button).");
        setInfo(bag);
        return;
      }

      const url = `${apiBase()}/api/auth/telegram`;
      log(bag, `POST ${url}`);

      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "1",
          },
          body: JSON.stringify({ init_data: initData }),
          credentials: "omit",
        });
      } catch (netErr) {
        log(bag, `FETCH_NET_ERR: ${(netErr as Error).message}`);
        setErr("Network xatolik — backendga yetmaydi");
        setInfo(bag);
        return;
      }

      log(bag, `status: ${res.status}`);
      const text = await res.text();
      log(bag, `body: ${text.slice(0, 200)}`);

      if (!res.ok) {
        setErr(`HTTP ${res.status}: ${text}`);
        setInfo(bag);
        return;
      }

      const tokens = JSON.parse(text) as { access_token: string; refresh_token: string };
      localStorage.setItem("yozuv_access", tokens.access_token);
      localStorage.setItem("yozuv_refresh", tokens.refresh_token);
      window.location.href = "/dashboard";
    } catch (e) {
      log(bag, `OUTER: ${(e as Error).message}`);
      setErr((e as Error).message || "Xatolik");
      setInfo(bag);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;
    if (initData) void loginWithTelegram();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-ink-50">
      <HeroGradient className="rounded-b-[32px] pb-24">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <YzLogo size={36} variant="light" />
            <div className="font-display text-[17px] font-bold tracking-tight text-white">
              Yozuv
            </div>
          </Link>
          <Link
            href="/"
            className="rounded-xl bg-white/14 px-3 py-1.5 text-xs font-bold text-white backdrop-blur tap"
          >
            Bosh sahifa
          </Link>
        </div>
        <div className="mx-auto mt-10 max-w-md">
          <div className="text-sm font-semibold text-white/70">Xush kelibsiz!</div>
          <h1 className="mt-1 font-display text-[32px] font-extrabold leading-tight tracking-[-0.02em] text-white">
            Kabinetga kiring
          </h1>
          <p className="mt-2 max-w-xs text-sm text-white/80">
            Telegram Mini App orqali bir bosishda avtorizatsiya.
          </p>
        </div>
      </HeroGradient>

      <div className="-mt-16 px-4 pb-20">
        <div className="mx-auto max-w-md">
          <div className="card-soft p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#229ED9]/10 text-[#229ED9]">
                <Send className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <div>
                <div className="font-display text-[15px] font-extrabold tracking-tight text-ink-900">
                  Telegram bilan kirish
                </div>
                <div className="text-xs text-ink-500">
                  Parol va e-mail kerak emas
                </div>
              </div>
            </div>

            <button
              onClick={loginWithTelegram}
              disabled={busy}
              className="btn-primary mt-5 w-full justify-center"
            >
              {busy ? "Kutilmoqda…" : "Telegram bilan kirish"}
              {!busy && <ArrowRight className="ml-2 h-4 w-4" />}
            </button>

            <ul className="mt-5 space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5 text-ink-700">
                <Shield className="mt-0.5 h-4 w-4 text-indigo-600" strokeWidth={2.4} />
                Ma‘lumotlaringiz xavfsiz, Telegram imzosi bilan tekshiriladi
              </li>
              <li className="flex items-start gap-2.5 text-ink-700">
                <Sparkles className="mt-0.5 h-4 w-4 text-indigo-600" strokeWidth={2.4} />
                14 kun bepul trial avtomatik yoqiladi
              </li>
            </ul>
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink-200" />
            <div className="text-xs font-semibold text-ink-400">yoki</div>
            <div className="h-px flex-1 bg-ink-200" />
          </div>

          <form onSubmit={loginWithPassword} className="card-soft p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-600/10 text-indigo-600">
                <KeyRound className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <div>
                <div className="font-display text-[15px] font-extrabold tracking-tight text-ink-900">
                  Login va parol bilan
                </div>
                <div className="text-xs text-ink-500">
                  Telefon raqami yoki username
                </div>
              </div>
            </div>

            <label className="mt-5 block">
              <span className="sr-only">Login</span>
              <div className="flex items-center gap-2.5 rounded-2xl border border-ink-200 bg-white px-3.5 py-3 focus-within:border-indigo-500">
                <UserIcon className="h-4 w-4 text-ink-400" strokeWidth={2.2} />
                <input
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  autoComplete="username"
                  inputMode="text"
                  placeholder="+998 90 123 45 67 yoki username"
                  className="w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
                />
              </div>
            </label>

            <label className="mt-3 block">
              <span className="sr-only">Parol</span>
              <div className="flex items-center gap-2.5 rounded-2xl border border-ink-200 bg-white px-3.5 py-3 focus-within:border-indigo-500">
                <Lock className="h-4 w-4 text-ink-400" strokeWidth={2.2} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Parol"
                  className="w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={pwBusy || loginId.trim().length < 3 || password.length < 6}
              className="btn-primary mt-5 w-full justify-center disabled:opacity-50"
            >
              {pwBusy ? "Kutilmoqda…" : "Kirish"}
              {!pwBusy && <ArrowRight className="ml-2 h-4 w-4" />}
            </button>
          </form>

          {err && (
            <div className="mt-4 rounded-[22px] bg-[#FFE7E3] p-4">
              <div className="font-display text-sm font-bold text-[#C93A2A]">
                Xatolik
              </div>
              <div className="mt-1 whitespace-pre-wrap text-xs text-[#C93A2A]/85">
                {err}
              </div>
            </div>
          )}

          {info.length > 0 && (
            <div className="mt-3 text-center">
              <button
                onClick={() => setDebug((v) => !v)}
                className="text-xs font-semibold text-ink-400"
              >
                {debug ? "Diagnostikani yashirish" : "Diagnostikani ko‘rsatish"}
              </button>
              {debug && (
                <pre className="mt-2 overflow-auto rounded-2xl bg-ink-100 p-3 text-left text-[10px] text-ink-500">
                  {info.join("\n")}
                </pre>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-xs text-ink-400">
            Hali hisobingiz yo‘qmi?{" "}
            <Link href="/auth/register" className="font-bold text-indigo-600">
              Ro‘yxatdan o‘tish
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
