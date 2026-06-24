"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined" && (window as unknown as { console: Console }).console) {
      console.error("Yozuv error:", error);
    }
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-ink-50 px-6 py-16">
      <div className="card-lg animate-card-in w-full max-w-md p-8 text-center sm:p-10">
        <div className="tile-coral mx-auto grid h-20 w-20 place-items-center rounded-3xl">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/70 shadow-soft-sm backdrop-blur">
            <AlertTriangle className="h-7 w-7 text-[#C93A2A]" strokeWidth={2.2} />
          </span>
        </div>
        <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tighter text-ink-900">
          Nimadir noto‘g‘ri ketdi
        </h1>
        <p className="mx-auto mt-2.5 max-w-xs text-sm leading-relaxed text-ink-500">
          Iltimos, qayta urinib ko‘ring. Agar muammo davom etsa, biz bilan bog‘laning.
        </p>

        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-primary justify-center"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Qayta urinish
          </button>
          <Link href="/" className="btn-soft justify-center">
            Bosh sahifaga
          </Link>
        </div>

        <a
          href="https://t.me/zimdevuz"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 underline-offset-2 hover:underline"
        >
          Yordam kerakmi? Telegram orqali yozing
        </a>
      </div>
    </main>
  );
}
