"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: unknown;
        ready?: () => void;
        expand?: () => void;
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
        setErr("initData bo'sh. Mini App orqali oching (menu button).");
        setInfo(bag);
        return;
      }

      const url = `${window.location.origin}/api/auth/telegram`;
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
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Logo size={48} />
      <h1 className="mt-6 font-serif text-3xl">Kirish</h1>
      <p className="mt-2 text-sm text-ink/60">Telegram Mini App orqali avtorizatsiya</p>
      <Button className="mt-8" onClick={loginWithTelegram} disabled={busy}>
        {busy ? "Kutilmoqda..." : "Telegram bilan kirish"}
      </Button>
      {err ? <p className="mt-4 text-sm text-red-600 whitespace-pre-wrap">{err}</p> : null}
      {info.length > 0 && (
        <pre className="mt-4 rounded-md bg-ink/5 p-3 text-[10px] text-ink/70 overflow-auto">
          {info.join("\n")}
        </pre>
      )}
    </div>
  );
}
