"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function SectionLabel({
  title,
  action,
  href,
  onAction,
}: {
  title: string;
  action?: string;
  href?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="section-title">{title}</h3>
      {action &&
        (href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-0.5 text-[13px] font-bold text-indigo-600"
          >
            {action}
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.6} />
          </Link>
        ) : (
          <button
            onClick={onAction}
            className="inline-flex items-center gap-0.5 text-[13px] font-bold text-indigo-600 tap"
          >
            {action}
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.6} />
          </button>
        ))}
    </div>
  );
}
