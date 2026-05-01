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
        <span className={cn("font-bold", active ? "opacity-70" : "opacity-60")}>{count}</span>
      )}
    </button>
  );
}
