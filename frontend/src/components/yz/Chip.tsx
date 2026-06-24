"use client";

import { cn } from "@/lib/utils";

export function Chip({
  children,
  active,
  className,
  count,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
  count?: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("chip tap", active && "chip-active", className)}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "tnum inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-5 tabular-nums",
            active ? "bg-white/20 text-white" : "bg-white/80 text-ink-700 shadow-sm",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
