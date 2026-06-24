"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, Lock, Send, Shield, Sparkles, User as UserIcon } from "lucide-react";
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
    <main
      className="min-h-screen bg-ink-50"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="px-4 pb-20 pt-6">
        <div className="mx-auto max-w-md">
          {/* Light Havodor header */}
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 tap">
              <YzLogo size={36} variant="dark" />
              <div className="font-display text-[17px] font-extrabold tracking-tight text-ink-900">
                Yozuv
              </div>
            </Link>
            <Link
              href="/"
              className="rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-ink-700 shadow-soft-sm tap"
            >
              Bosh sahifa
            </Link>
          </div>

          <div className="mt-9 animate-card-in">
            <div className="eyebrow">Xush kelibsiz!</div>
            <h1 className="mt-2 display-xl text-[34px] leading-[1.05]">
              Kabinetga kiring
            </h1>
            <p className="mt-2.5 max-w-xs text-sm text-ink-500">
              Telegram Mini App orqali bir bosishda avtorizatsiya.
            </p>
          </div>

          {/* Telegram — the single bright feature moment */}
          <div className="yz-feature mt-7 rounded-4xl p-6 text-white animate-card-in">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 text-white backdrop-blur">
                <Send className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <div>
                <div className="font-display text-[15px] font-extrabold tracking-tight text-white">
                  Telegram bilan kirish
                </div>
                <div className="text-xs text-white/75">
                  Parol va e-mail kerak emas
                </div>
              </div>
            </div>

            <button
              onClick={loginWithTelegram}
              disabled={busy}
              className="btn-soft mt-5 w-full justify-center text-indigo-600 disabled:opacity-50"
            >
              {busy ? "Kutilmoqda…" : "Telegram bilan kirish"}
              {!busy && <ArrowRight className="ml-2 h-4 w-4" />}
            </button>

            <ul className="mt-5 space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5 text-white/90">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-white" strokeWidth={2.4} />
                Ma‘lumotlaringiz xavfsiz, Telegram imzosi bilan tekshiriladi
              </li>
              <li className="flex items-start gap-2.5 text-white/90">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-white" strokeWidth={2.4} />
                14 kun bepul trial avtomatik yoqiladi
              </li>
            </ul>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink-200" />
            <div className="text-xs font-semibold text-ink-400">yoki</div>
            <div className="h-px flex-1 bg-ink-200" />
          </div>

          <form onSubmit={loginWithPassword} className="card-lg p-6 animate-card-in">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
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
                  placeholder="+998 90 123 45 67 yoki username"
                  className="yz-input pl-11 tnum"
                />
              </div>
            </label>

            <label className="mt-3 block">
              <span className="sr-only">Parol</span>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                  strokeWidth={2.2}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Parol"
                  className="yz-input pl-11"
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
            <div className="tile-coral mt-4 animate-card-in">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-white/70 text-[#C93A2A]">
                  <Shield className="h-4 w-4" strokeWidth={2.4} />
                </div>
                <div className="font-display text-sm font-bold text-[#C93A2A]">
                  Xatolik
                </div>
              </div>
              <div className="mt-2 whitespace-pre-wrap text-xs text-[#C93A2A]/85">
                {err}
              </div>
            </div>
          )}

          {info.length > 0 && (
            <div className="mt-3 text-center">
              <button
                onClick={() => setDebug((v) => !v)}
                className="text-xs font-semibold text-ink-400 tap"
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

          <p className="mt-7 text-center text-xs text-ink-400">
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
