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
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#FFE7E3]">
          <AlertTriangle className="h-8 w-8 text-[#C93A2A]" strokeWidth={2.2} />
        </div>
        <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-ink-900">
          Nimadir noto‘g‘ri ketdi
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          Iltimos, qayta urinib ko‘ring. Agar muammo davom etsa, biz bilan bog‘laning.
        </p>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-primary justify-center"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Qayta urinish
          </button>
          <Link
            href="/"
            className="rounded-2xl bg-white px-5 py-3.5 font-display text-[15px] font-bold text-ink-900 shadow-soft tap"
          >
            Bosh sahifaga
          </Link>
        </div>

        <a
          href="https://t.me/zimdevuz"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 underline-offset-2 hover:underline"
        >
          Yordam kerakmi? Telegram orqali yozing
        </a>
      </div>
    </main>
  );
}
