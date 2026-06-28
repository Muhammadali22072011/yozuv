"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { track } from "@/lib/analytics";

/** Landing CTA that reports a `cta_click` with its placement before routing to
 *  the signup flow. Client component so it can run analytics on click; reused
 *  by the landing page hero/final CTAs and the sticky bar below. The single
 *  consistent destination keeps the «Bepul boshlash» action unified. */
export function CtaLink({
  where,
  href = "/auth/login",
  className,
  style,
  children,
}: {
  where: string;
  href?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      onClick={() => track("cta_click", { where })}
    >
      {children}
    </Link>
  );
}

/** Mobile-only sticky bottom CTA — the action is always one tap away while
 *  the visitor scrolls. Hidden on md+ where the hero/pricing CTAs suffice. */
export function StickyCTA() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white/90 px-4 py-3 backdrop-blur md:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <CtaLink
        where="sticky"
        className="btn-primary tap w-full justify-center gap-2 text-[15px]"
      >
        Bepul boshlash — 14 kun <ArrowRight className="h-4 w-4" />
      </CtaLink>
    </div>
  );
}
