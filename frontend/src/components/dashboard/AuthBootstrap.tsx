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

    type Me = { has_password?: boolean };
    // ok → got /me. auth=true → token rejected (401/403). auth=false →
    // couldn't reach the server (network / 5xx), i.e. transient.
    type MeResult = { ok: true; me: Me } | { ok: false; auth: boolean };

    async function fetchMe(token: string): Promise<MeResult> {
      try {
        const res = await fetch(`${apiBase()}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "1",
          },
          credentials: "omit",
        });
        if (res.ok) return { ok: true, me: (await res.json()) as Me };
        return { ok: false, auth: res.status === 401 || res.status === 403 };
      } catch {
        return { ok: false, auth: false };
      }
    }

    // Mint a fresh access token from the stored refresh token. "ok" stores the
    // new pair; "invalid" means the refresh token itself is rejected (real
    // logout); "error" means the server was unreachable (keep the session).
    async function refreshTokens(): Promise<"ok" | "invalid" | "error"> {
      const refresh =
        typeof window !== "undefined" ? localStorage.getItem("yozuv_refresh") : null;
      if (!refresh) return "invalid";
      try {
        const res = await fetch(`${apiBase()}/api/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "1",
          },
          body: JSON.stringify({ refresh_token: refresh }),
          credentials: "omit",
        });
        if (res.ok) {
          const t = (await res.json()) as { access_token: string; refresh_token: string };
          localStorage.setItem("yozuv_access", t.access_token);
          localStorage.setItem("yozuv_refresh", t.refresh_token);
          return "ok";
        }
        return res.status === 401 || res.status === 403 ? "invalid" : "error";
      } catch {
        return "error";
      }
    }

    // Forced login+password setup: an account that has authenticated but has
    // no password yet can't enter the dashboard. Returns true when it sent
    // the browser to /auth/setup, so the caller stops. `has_password` is only
    // gated on an explicit `false`, so an older backend (field absent) is a
    // no-op rather than a redirect loop.
    function gateOnPasswordSetup(me: Me): boolean {
      if (me.has_password === false) {
        window.location.replace("/auth/setup");
        return true;
      }
      return false;
    }

    async function bootstrap() {
      const existing =
        typeof window !== "undefined" ? localStorage.getItem("yozuv_access") : null;
      if (existing) {
        let result = await fetchMe(existing);

        // Access token rejected → mint a new one from the refresh token before
        // discarding the session. Browser/native users come back after the
        // ~60-min access token expired while the refresh token is still valid;
        // without this they'd be bounced to /auth/login on every dashboard load.
        if (!result.ok && result.auth) {
          const rt = await refreshTokens();
          if (rt === "ok") {
            result = await fetchMe(localStorage.getItem("yozuv_access") || "");
          }
        }

        if (result.ok) {
          if (gateOnPasswordSetup(result.me)) return;
          if (!cancelled) setState("ready");
          return;
        }

        // Couldn't reach the server — keep the (possibly valid) tokens and let
        // the user retry instead of nuking a recoverable session.
        if (!result.auth) {
          if (!cancelled) {
            setError("Server bilan bog'lanib bo'lmadi. Qayta urinib ko'ring.");
            setState("failed");
          }
          return;
        }

        // Definitively unauthenticated — drop tokens and fall through to re-auth.
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
        // Fresh Telegram sign-in: gate on the password-setup step before
        // letting the dashboard render.
        const fresh = localStorage.getItem("yozuv_access");
        const meRes = fresh ? await fetchMe(fresh) : null;
        if (meRes && meRes.ok && gateOnPasswordSetup(meRes.me)) return;
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
