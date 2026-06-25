"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { YzLoader } from "@/components/yz/Loader";

/**
 * OAuth return target. The backend redirects here with the tokens in the URL
 * FRAGMENT (#access=…&refresh=…) so they never reach a server log, then this
 * page stores them and forwards to the dashboard.
 */
export default function AuthCallbackPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      const raw = window.location.hash.replace(/^#/, "");
      const params = new URLSearchParams(raw);
      const access = params.get("access");
      const refresh = params.get("refresh");
      if (access && refresh) {
        localStorage.setItem("yozuv_access", access);
        localStorage.setItem("yozuv_refresh", refresh);
        // replace() drops the token-bearing URL from history.
        window.location.replace("/dashboard");
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    }
  }, []);

  if (failed) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="font-display text-lg font-extrabold text-ink-900">
          Kirish amalga oshmadi
        </div>
        <Link href="/auth/login" className="btn-primary justify-center px-6">
          Qayta urinish
        </Link>
      </div>
    );
  }

  return <YzLoader fullscreen />;
}
