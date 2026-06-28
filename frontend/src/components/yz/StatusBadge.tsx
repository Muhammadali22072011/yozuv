import type { BookingStatus } from "@/types";
import { cn } from "@/lib/utils";

const MAP: Record<BookingStatus, { bg: string; fg: string; label: string }> = {
  CONFIRMED: { bg: "bg-success-bg", fg: "text-success", label: "Tasdiqlangan" },
  PENDING: { bg: "bg-warn-bg", fg: "text-warn", label: "Kutilmoqda" },
  CANCELLED: { bg: "bg-danger-bg", fg: "text-danger", label: "Bekor" },
  COMPLETED: { bg: "bg-ink-100", fg: "text-ink-500", label: "Yakunlangan" },
};

export function StatusBadge({
  status,
  className,
  compact,
}: {
  status: BookingStatus;
  className?: string;
  compact?: boolean;
}) {
  const s = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold",
        s.bg,
        s.fg,
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        className
      )}
    >
      {s.label}
    </span>
  );
}

export function statusAccent(status: BookingStatus) {
  if (status === "PENDING") return "#FFC94A";
  if (status === "CANCELLED") return "#FF7A6B";
  if (status === "COMPLETED") return "#B9BECD";
  return "#5B6BFF";
}
