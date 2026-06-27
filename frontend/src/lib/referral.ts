import { getStartParam } from "@/lib/platform";

/**
 * Capture a B2B referral code and stash it in localStorage so it survives the
 * login round-trip; onboarding sends it on business creation. Two sources:
 *   • plain browser  → ?ref=CODE in the URL
 *   • Telegram Mini App opened via t.me/<bot>?startapp=ref_<CODE>
 *     → Telegram hands the payload as start_param ("ref_<CODE>").
 *
 * Idempotent and safe to call on any page mount — the invitee may land on the
 * marketing landing (/) first, not /auth/login, so we capture app-wide.
 */
export function captureReferral(): void {
  if (typeof window === "undefined") return;
  let ref = new URLSearchParams(window.location.search).get("ref");
  if (!ref) {
    const sp = getStartParam();
    if (sp && sp.startsWith("ref_")) ref = sp.slice("ref_".length);
  }
  if (ref) localStorage.setItem("yozuv_ref", ref.trim().toUpperCase().slice(0, 16));
}
