"use client";

import Link from "next/link";

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
          <Link href={href} className="text-[13px] font-bold text-indigo-600">
            {action}
          </Link>
        ) : (
          <button onClick={onAction} className="text-[13px] font-bold text-indigo-600 tap">
            {action}
          </button>
        ))}
    </div>
  );
}
