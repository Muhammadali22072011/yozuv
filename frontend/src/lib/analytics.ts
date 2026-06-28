/**
 * Lightweight, vendor-agnostic funnel event tracking.
 *
 * There is no analytics stack wired up yet, so this module is intentionally
 * a thin, fail-safe shim: it never throws, never blocks the UI, and is a
 * no-op during SSR. Components just `import { track } from "@/lib/analytics"`
 * and fire named events; wiring up a real sink is a one-line decision later.
 *
 * ## How to connect a real analytics provider
 *
 * No code change here is required — `track()` auto-detects whichever global
 * the provider's snippet installs on `window`. Add ONE of these:
 *
 *   • Google Analytics (gtag.js): drop the GA4 snippet in the app <head>.
 *     `window.gtag('event', name, props)` will be called automatically.
 *
 *   • PostHog: call `posthog.init(...)` once on boot. Events route to
 *     `window.posthog.capture(name, props)`.
 *
 *   • Plausible: add the Plausible script tag. Events route to
 *     `window.plausible(name, { props })`.
 *
 * Until any of those exist, events are logged via `console.debug` in dev and
 * silently dropped in production. Multiple providers may coexist — every
 * detected sink receives the event.
 */

/**
 * Closed set of funnel event names. Keep this union authoritative so call
 * sites stay type-checked and the analytics dashboard has a stable schema.
 */
import { apiBase } from "@/lib/api";

export type AnalyticsEvent =
  | "cta_click"
  | "landing_to_bot"
  | "login_view"
  | "login_bot_open"
  | "plan_select"
  | "onboarding_step"
  | "onboarding_completed"
  | "first_booking_try"
  | "referral_share";

/** Arbitrary, JSON-serialisable event metadata (plan, step, source, …). */
export type AnalyticsProps = Record<string, unknown>;

interface AnalyticsWindow {
  gtag?: (command: "event", event: string, props?: AnalyticsProps) => void;
  posthog?: { capture: (event: string, props?: AnalyticsProps) => void };
  plausible?: (event: string, options?: { props?: AnalyticsProps }) => void;
}

/**
 * Record a funnel event. Safe to call anywhere — it is a no-op on the server
 * and is fully wrapped in try/catch so a misbehaving provider can never break
 * the calling component.
 *
 * @param event - One of the typed {@link AnalyticsEvent} names.
 * @param props - Optional metadata (e.g. `{ plan: "pro", step: 2 }`).
 */
/**
 * Always-on first-party sink: POST the event to our own backend so the funnel
 * is measurable from server logs even when no third-party provider is wired
 * up. sendBeacon survives the navigation a CTA click triggers; fetch+keepalive
 * is the fallback. Fully fail-safe.
 */
function beaconToBackend(event: string, props: AnalyticsProps): void {
  try {
    const url = `${apiBase()}/api/events`;
    const payload = JSON.stringify({
      event,
      props,
      path: window.location.pathname,
    });
    // text/plain is CORS-safelisted, so sendBeacon delivers cross-origin
    // (frontend → API host) without a preflight. The backend reads the raw
    // body and JSON-parses it, so the wire content type doesn't matter.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(url, new Blob([payload], { type: "text/plain" }));
    } else {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: payload,
        keepalive: true,
      });
    }
  } catch {
    /* analytics must never break the UI */
  }
}

export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (typeof window === "undefined") return;

  try {
    const w = window as unknown as AnalyticsWindow;
    beaconToBackend(event, props ?? {});
    let delivered = false;

    if (typeof w.gtag === "function") {
      w.gtag("event", event, props);
      delivered = true;
    }
    if (w.posthog && typeof w.posthog.capture === "function") {
      w.posthog.capture(event, props);
      delivered = true;
    }
    if (typeof w.plausible === "function") {
      w.plausible(event, props ? { props } : undefined);
      delivered = true;
    }

    if (!delivered && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[track]", event, props ?? {});
    }
  } catch {
    /* analytics must never break the UI */
  }
}

/**
 * Record a page view. Mirrors {@link track} semantics (SSR-safe, never throws)
 * and forwards to whichever provider is present:
 *   • gtag → `page_view` event with `page_path`
 *   • PostHog → `$pageview`
 *   • Plausible → tracks the current URL automatically, so this is a no-op
 *
 * @param path - Optional path override; defaults to the current location.
 */
export function trackPageView(path?: string): void {
  if (typeof window === "undefined") return;

  try {
    const w = window as unknown as AnalyticsWindow;
    const page = path ?? window.location.pathname + window.location.search;
    let delivered = false;

    if (typeof w.gtag === "function") {
      w.gtag("event", "page_view", { page_path: page });
      delivered = true;
    }
    if (w.posthog && typeof w.posthog.capture === "function") {
      w.posthog.capture("$pageview", { page });
      delivered = true;
    }

    if (!delivered && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[track] page_view", page);
    }
  } catch {
    /* analytics must never break the UI */
  }
}
