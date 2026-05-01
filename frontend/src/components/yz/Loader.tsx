"use client";

import { cn } from "@/lib/utils";

export function YzLoader({
  label = "Yuklanmoqda",
  fullscreen = false,
  className,
}: {
  label?: string;
  fullscreen?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5",
        fullscreen ? "min-h-[80vh]" : "min-h-[60vh] py-16",
        className
      )}
    >
      <div className="relative grid h-20 w-20 place-items-center">
        <span
          className="absolute inset-0 rounded-[22px] animate-yz-pulse"
          style={{
            background:
              "radial-gradient(closest-side, rgba(72,83,245,0.35), rgba(72,83,245,0) 70%)",
          }}
        />
        <span
          className="absolute inset-2 rounded-2xl border-2 border-indigo-500/25 border-t-indigo-600 animate-spin"
          style={{ animationDuration: "1.1s" }}
        />
        <span
          className="grid h-12 w-12 place-items-center rounded-[14px] font-display text-[22px] font-extrabold text-white"
          style={{
            background: "linear-gradient(135deg,#5B6BFF,#3640D4)",
            boxShadow: "0 10px 24px rgba(72,83,245,0.45)",
          }}
        >
          Y
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="font-display text-[13px] font-semibold tracking-tight text-ink-500">
          {label}
        </span>
        <span className="flex gap-0.5">
          <span
            className="h-1 w-1 rounded-full bg-indigo-500 animate-yz-dot"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="h-1 w-1 rounded-full bg-indigo-500 animate-yz-dot"
            style={{ animationDelay: "160ms" }}
          />
          <span
            className="h-1 w-1 rounded-full bg-indigo-500 animate-yz-dot"
            style={{ animationDelay: "320ms" }}
          />
        </span>
      </div>
    </div>
  );
}
