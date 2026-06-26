"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/platform";

/**
 * Android APK only: catches the yozuv:// deep link the backend redirects to
 * after Google OAuth (which runs in the system browser / Custom Tab, since
 * Google blocks OAuth inside an embedded WebView). Stores the tokens and
 * returns the user to the dashboard. No-op on web / Telegram.
 *
 * NOTE: requires `@capacitor/app` + `@capacitor/browser` (declared in
 * package.json) and a yozuv:// intent-filter in AndroidManifest.xml. Needs a
 * device/APK build to verify — not exercised by the web build.
 */
export function CapacitorDeepLink() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener(
          "appUrlOpen",
          async (event: { url: string }) => {
            const url = event.url || "";
            if (!url.startsWith("yozuv://")) return;
            try {
              const { Browser } = await import("@capacitor/browser");
              await Browser.close();
            } catch {
              // browser plugin missing — ignore
            }
            const hash = url.includes("#") ? url.split("#")[1] : "";
            const params = new URLSearchParams(hash);
            const access = params.get("access");
            const refresh = params.get("refresh");
            if (access && refresh) {
              localStorage.setItem("yozuv_access", access);
              localStorage.setItem("yozuv_refresh", refresh);
              router.replace("/dashboard");
              return;
            }
            // Account-link return: yozuv://dashboard/settings?linked=google
            if (url.includes("/dashboard/settings")) {
              const q = url.includes("?")
                ? url.split("?")[1].split("#")[0]
                : "";
              router.replace(`/dashboard/settings?${q}`);
            }
          },
        );
        cleanup = () => {
          handle.remove();
        };
      } catch {
        // @capacitor/app unavailable (web build) — nothing to listen for.
      }
    })();

    return () => {
      if (cleanup) cleanup();
    };
  }, [router]);

  return null;
}
