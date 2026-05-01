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
    <div className="flex items-start gap-3 px-4 pt-4 pb-3 md:px-0">
      {showBack && (
        <button
          onClick={go}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white shadow-soft tap"
          aria-label="Orqaga"
        >
          <ArrowLeft className="h-5 w-5 text-ink-900" strokeWidth={2.4} />
        </button>
      )}
      <div className="flex-1 pt-1">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <div className="mt-0.5 text-[13px] font-medium text-ink-400">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}
