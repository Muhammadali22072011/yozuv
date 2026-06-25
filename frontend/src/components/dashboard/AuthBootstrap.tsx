"use client";

import { useEffect, useState } from "react";
import { YzLoader } from "@/components/yz/Loader";
import { apiBase } from "@/lib/api";
import { isTelegramMiniApp } from "@/lib/platform";

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

// Brand indigo (matches the YzLogo gradient and the dashboard hero).
// Setting this on the WebApp header gets rid of Telegram's default
// black bar at the top and the white sliver between the WebApp and
// the system chrome on desktop.
const BRAND_BG = "#4853F5";

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "ready" | "failed">("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function exchangeInitData(): Promise<boolean> {
      try {
        const wa = window.Telegram?.WebApp;
        wa?.ready?.();
        wa?.expand?.();
        wa?.setHeaderColor?.(BRAND_BG);
        wa?.setBackgroundColor?.(BRAND_BG);
      } catch {
        // noop
      }
      const initData = window.Telegram?.WebApp?.initData;
      if (!initData) return false;
      const res = await fetch(`${apiBase()}/api/auth/telegram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "1",
        },
        body: JSON.stringify({ init_data: initData }),
        credentials: "omit",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
      }
      const tokens = (await res.json()) as { access_token: string; refresh_token: string };
      localStorage.setItem("yozuv_access", tokens.access_token);
      localStorage.setItem("yozuv_refresh", tokens.refresh_token);
      return true;
    }

    async function tokenIsValid(token: string): Promise<boolean> {
      const res = await fetch(`${apiBase()}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "1",
        },
        credentials: "omit",
      });
      return res.ok;
    }

    async function bootstrap() {
      const existing =
        typeof window !== "undefined" ? localStorage.getItem("yozuv_access") : null;
      if (existing) {
        try {
          if (await tokenIsValid(existing)) {
            if (!cancelled) setState("ready");
            return;
          }
        } catch {
          // fallthrough to re-auth
        }
        localStorage.removeItem("yozuv_access");
        localStorage.removeItem("yozuv_refresh");
      }

      try {
        const ok = await exchangeInitData();
        if (!ok) {
          if (typeof window !== "undefined") {
            // Redirect-loop guard: if we already came from /auth/login,
            // don't bounce back — show the failure UI instead.
            const cameFromLogin =
              document.referrer.includes("/auth/login") ||
              sessionStorage.getItem("yz_auth_redirect_attempt") === "1";
            if (cameFromLogin) {
              if (!cancelled) {
                setError(
                  isTelegramMiniApp()
                    ? "Telegram initData yo'q. Mini App orqali qayta oching."
                    : "Tizimga kiring — login va parol bilan.",
                );
                setState("failed");
              }
              return;
            }
            sessionStorage.setItem("yz_auth_redirect_attempt", "1");
            window.location.replace("/auth/login");
          }
          return;
        }
        try {
          sessionStorage.removeItem("yz_auth_redirect_attempt");
        } catch {
          // noop
        }
        if (!cancelled) setState("ready");
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setState("failed");
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "checking") {
    return <YzLoader fullscreen />;
  }

  if (state === "failed") {
    const inTelegram = isTelegramMiniApp();
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="font-display text-lg font-extrabold text-ink-900">
          Kirish amalga oshmadi
        </div>
        <div className="text-sm text-ink-500">
          {inTelegram
            ? "Mini App orqali qayta oching yoki botga /start yuboring."
            : "Login va parol bilan tizimga kiring."}
        </div>
        {!inTelegram && (
          <a
            href="/auth/login"
            className="btn-primary mt-1 justify-center px-6"
          >
            Tizimga kirish
          </a>
        )}
        {error && (
          <pre className="mt-2 max-w-sm overflow-auto rounded-2xl bg-ink-100 p-3 text-left text-[10px] text-ink-500">
            {error}
          </pre>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
