"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function ScreenHeader({
  title,
  subtitle,
  back,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean | string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const showBack = back !== undefined && back !== false;
  const go = () => {
    if (onBack) return onBack();
    if (typeof back === "string") return router.push(back);
    return router.back();
  };

  return (
    <div className="flex items-center gap-3 px-4 pt-4 pb-3 md:px-0">
      {showBack && (
        <button
          onClick={go}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-ink-700 shadow-soft-sm tap-icon"
          aria-label="Orqaga"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="display-xl truncate text-[26px] leading-none">{title}</h1>
        {subtitle && (
          <div className="mt-1.5 truncate text-[13px] font-medium text-ink-400">{subtitle}</div>
        )}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}
