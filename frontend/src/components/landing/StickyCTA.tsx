import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Mobile-only sticky bottom CTA — the action is always one tap away while
 *  the visitor scrolls. Hidden on md+ where the hero/pricing CTAs suffice. */
export function StickyCTA() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white/90 px-4 py-3 backdrop-blur md:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <Link
        href="/auth/login"
        className="btn-primary tap w-full justify-center gap-2 text-[15px]"
      >
        Bepul boshlash — 14 kun <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
